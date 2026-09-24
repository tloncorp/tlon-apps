import { Noun } from '@urbit/nockjs';
import _ from 'lodash';

import {
  AuthError,
  ChannelPutError,
  ChannelStatus,
  NounPokeInterface,
  ReapError,
  SSEBadResponseError,
  SSETimeoutError,
  SpinAbortedError,
  SpinClosedError,
  Thread,
  Urbit,
} from '../http-api';
import { createDevLogger, escapeLog, runIfDev } from '../lib/logger';
import { preSig } from '../lib/urbit';
import { AnalyticsEvent } from '../types/analytics';
import { getConstants } from '../types/constants';
import * as Hosting from '../types/hosting';
import { AuthFailureError, getLandscapeAuthCookie } from './landscapeApi';

const logger = createDevLogger('urbit', false);

const DEFAULT_SCRY_TIMEOUT = 60 * 1000; // 1 minute
const DEFAULT_THREAD_TIMEOUT = 90 * 1000; // 90 seconds

// One configured account: its client, the ship that client talks to, the
// app's credential hooks, and the reauth state that only means anything for
// that account. `internalConfigureClient` makes a new one when the client or
// ship changes and `internalRemoveClient` drops it. Reauth and the retry
// paths keep the Session they started with instead of re-reading `config`,
// so a logout or account switch in the middle of one leaves them holding an
// object that is no longer the configured one -- which they check for --
// rather than acting on whatever account is installed now.
interface Session {
  client: Urbit;
  shipUrl: string;
  getCode: ClientParams['getCode'];
  handleAuthFailure: ClientParams['handleAuthFailure'];
  // the login in flight, if any; every caller that fails while it runs
  // shares it
  pendingAuth: Promise<string | void> | null;
  // bumped on every successful reauth so a request that failed while a
  // reauth was already in flight can retry without starting another one
  authEpoch: number;
  // the ship rejected the access code and the app was told to log out; no
  // further login is attempted for this account
  loggingOut: boolean;
}

interface Config extends Pick<ClientParams, 'onQuitOrReset'> {
  session: Session | null;
  // derived from `session`: the verbs only need the client, and most of
  // them never touch the rest
  readonly client: Urbit | null;
  readonly shipUrl: string;
  subWatchers: Watchers;
  lastStatus: string;
  activitySupportsReactions: boolean;
  activitySupportsNotes: boolean;
}

type Predicate = (event: any, mark: string) => boolean;
interface Watcher {
  id: string;
  predicate: Predicate;
  resolve: (value: void | PromiseLike<void>) => void;
  reject: (reason?: any) => void;
}

type Watchers = Record<string, Map<string, Watcher>>;

export type PokeParams = {
  app: string;
  mark: string;
  json: any;
};

export type NounPokeParams = {
  app: string;
  mark: string;
  noun: Noun;
};

export class BadResponseError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    const prefix = status > 0 ? `HTTP ${status}` : 'HTTP request failed';
    const detail = body.trim();
    super(detail ? `${prefix}: ${detail}` : prefix);
    this.name = 'BadResponseError';
  }
}

export class TimeoutError extends Error {
  connectionStatus: string;
  timeoutDuration: number | null;

  constructor({
    connectionStatus,
    timeoutDuration,
  }: {
    connectionStatus?: string;
    timeoutDuration?: number;
  }) {
    super(`TimeoutError: ${connectionStatus}`);
    this.connectionStatus = connectionStatus || 'unknown';
    this.timeoutDuration = timeoutDuration ?? null;
  }
}

interface UrbitEndpoint {
  app: string;
  path: string;
}

export interface ClientParams {
  shipName: string;
  shipUrl: string;
  verbose?: boolean;
  fetchFn?: typeof fetch;
  getCode?: () => Promise<string>;
  handleAuthFailure?: (params: { mustLogout: boolean }) => void;
  onQuitOrReset?: (
    cause: 'subscriptionQuit' | 'reset',
    relevantSubscription?: string
  ) => void;
  onChannelStatusChange?: (status: ChannelStatus) => void;
  client?: Urbit;
}

const config: Config = {
  session: null,
  get client() {
    return this.session?.client ?? null;
  },
  get shipUrl() {
    return this.session?.shipUrl ?? '';
  },
  lastStatus: '',
  subWatchers: {},
  onQuitOrReset: undefined,
  // Off until the app confirms the backend's groups version ships reactions.
  // Drives which %activity endpoint versions the client uses (feed/sub/marks).
  activitySupportsReactions: false,
  // Off until the app confirms the backend's groups version ships notes
  // activity (v10 %activity endpoints).
  activitySupportsNotes: false,
};

type ClientResolver = () => Urbit | null | undefined;
let clientResolver: ClientResolver | null = null;

/**
 * Let a server runtime provide an async-context-local client while preserving
 * the configured singleton as the default for app clients. Returning
 * `undefined` uses that default; `null` explicitly represents an empty scope.
 */
export function setClientResolver(resolver: ClientResolver | null): void {
  clientResolver = resolver;
}

function resolveClient(): Urbit | null {
  const resolved = clientResolver?.();
  return resolved === undefined ? config.client : resolved;
}

// The capability flags below start false every boot and flip when app-info
// sync resolves the backend version. Long-lived consumers that bake a
// capability into something at call time (e.g. a subscription's stream
// version) can subscribe here and redo that work when the flags change.
let activityCapabilitiesEpoch = 0;
const activityCapabilityListeners = new Set<() => void>();

export const getActivityCapabilitiesEpoch = (): number => {
  return activityCapabilitiesEpoch;
};

export const onActivityCapabilitiesChange = (
  listener: () => void
): (() => void) => {
  activityCapabilityListeners.add(listener);
  return () => {
    activityCapabilityListeners.delete(listener);
  };
};

const bumpActivityCapabilitiesEpoch = () => {
  activityCapabilitiesEpoch += 1;
  activityCapabilityListeners.forEach((listener) => listener());
};

// Whether the connected backend supports reaction activity (v9 %activity
// endpoints). Set by the app from the backend's groups version; read by the
// activity client to pick endpoint versions. Defaults false so an old backend
// gets the pre-reaction (v5 feed / v4 subscription / v8 mark) endpoints.
export const setActivitySupportsReactions = (value: boolean) => {
  const changed = config.activitySupportsReactions !== value;
  config.activitySupportsReactions = value;
  if (changed) {
    bumpActivityCapabilitiesEpoch();
  }
};

export const getActivitySupportsReactions = (): boolean => {
  return config.activitySupportsReactions;
};

// Whether the connected backend supports notes activity (v10 %activity
// endpoints: v6 subscription, v7 feed, activity-action-2 mark). Same pattern
// as reactions above; defaults false so old backends get older endpoints.
export const setActivitySupportsNotes = (value: boolean) => {
  const changed = config.activitySupportsNotes !== value;
  config.activitySupportsNotes = value;
  if (changed) {
    bumpActivityCapabilitiesEpoch();
  }
};

export const getActivitySupportsNotes = (): boolean => {
  return config.activitySupportsNotes;
};

export const client = new Proxy(
  {},
  {
    get: function (target, prop, receiver) {
      const activeClient = resolveClient();
      if (!activeClient) {
        throw new Error('Urbit client not set.');
      }
      return Reflect.get(activeClient, prop, receiver);
    },
  }
) as Urbit;

export const getCurrentUserId = () => {
  if (!client.nodeId) {
    throw new Error('Client not initialized');
  }
  return client.nodeId;
};

export const getCurrentUserIsHosted = () => {
  if (!client.nodeId) {
    throw new Error('Client not initialized');
  }

  // prefer referencing client URL if available
  if (client.url) {
    return Hosting.nodeUrlIsHosted(client.url);
  }

  /*
    On web, client URL is implicit based on location
    Note: during development, the true URL is supplied via the environment. Localhost is
    set up to redirect there
  */
  const env = getConstants();
  const implicitUrl = __DEV__ ? env.DEV_SHIP_URL : window.location.hostname;
  return Hosting.nodeUrlIsHosted(implicitUrl);
};

export function internalConfigureClient({
  shipName,
  shipUrl,
  verbose,
  fetchFn,
  getCode,
  handleAuthFailure,
  onQuitOrReset,
  onChannelStatusChange,
  client: injectedClient,
}: ClientParams) {
  const client =
    injectedClient || config.client || new Urbit(shipUrl, '', '', fetchFn);
  client.verbose = verbose;
  client.nodeId = preSig(shipName);
  const current = config.session;
  if (current && current.client === client && current.shipUrl === shipUrl) {
    // the same account, configured again: take the new hooks and carry on.
    // Only a different client or ship is a switch, so a login in flight for
    // this one keeps going; and a forced logout under the previous
    // configuration must not leave reauth disabled for this one.
    current.getCode = getCode;
    current.handleAuthFailure = handleAuthFailure;
    current.loggingOut = false;
  } else {
    // a different account. The new object is what tells a login or retry
    // still running for the old one that it has been swapped out.
    config.session = {
      client,
      shipUrl,
      getCode,
      handleAuthFailure,
      pendingAuth: null,
      authEpoch: 0,
      loggingOut: false,
    };
  }
  config.onQuitOrReset = onQuitOrReset;
  config.subWatchers = {};

  // the below event handlers will only fire if verbose is set to true
  client.on('status-update', (event) => {
    logger.trackEvent(AnalyticsEvent.NodeConnectionDebug, {
      context: 'status update',
      connectionStatus: event.status,
      statusUpdateContext: event.context ? event.context : null,
    });
    config.lastStatus = event.status;
    onChannelStatusChange?.(event.status);
  });

  client.on('fact', (fact) => {
    logger.log(
      'received message',
      runIfDev(() => escapeLog(JSON.stringify(fact)))
    );
  });

  client.on('seamless-reset', () => {
    logger.log('client seamless-reset');
    logger.trackEvent(AnalyticsEvent.NodeConnectionDebug, {
      context: 'seamless-reset',
    });
    config.onQuitOrReset?.('reset');
  });

  client.on('error', (error) => {
    logger.log('client error', error);
  });

  client.on('channel-reaped', () => {
    logger.trackEvent(AnalyticsEvent.NodeConnectionDebug, {
      context: 'client channel reaped',
    });
    logger.log('client channel-reaped');
  });
}

export async function configureClient(params: ClientParams) {
  const { client: injectedClient, fetchFn, getCode, shipUrl } = params;
  const code = !injectedClient && getCode ? await getCode() : '';
  const nextClient =
    injectedClient || config.client || new Urbit(shipUrl, code, '', fetchFn);

  if (!injectedClient && code) {
    nextClient.code = code;
  }

  internalConfigureClient({
    ...params,
    client: nextClient,
  });

  if (!injectedClient && code) {
    await nextClient.connect();
    await nextClient.eventSource();
  }
}

/**
 * URL of the ship this client is configured for, or null before
 * `configureClient` has run. Used to classify where a request failed when the
 * error itself does not name a host.
 */
export function getConfiguredShipUrl(): string | null {
  return config.shipUrl.length > 0 ? config.shipUrl : null;
}

export function internalRemoveClient() {
  config.client?.delete();
  // a login or retry still holding this session sees that it is no longer
  // the configured one and stops; see reauth and performReauth
  config.session = null;
  config.subWatchers = {};
  // backend capabilities belong to the ship we were connected to; reset
  // so an account switch to an older backend doesn't request newer
  // endpoints until app-info sync resolves the new ship's version
  setActivitySupportsReactions(false);
  setActivitySupportsNotes(false);
}

function printEndpoint(endpoint: UrbitEndpoint) {
  return `${endpoint.app}${endpoint.path}`;
}

// Error instances serialize to `{}` once they reach analytics, so pull the
// useful bits out. `error` is what the debug logger knows how to unpack into
// errorMessage/errorStack; the rest covers eyre's string nacks and Responses.
function describeError(err: unknown) {
  const shaped = err as { name?: unknown; status?: unknown } | null | undefined;
  return {
    error: err instanceof Error ? err : undefined,
    rawError: err instanceof Error ? undefined : String(err),
    errorName: typeof shaped?.name === 'string' ? shaped.name : undefined,
    errorStatus: typeof shaped?.status === 'number' ? shaped.status : undefined,
  };
}

// Eyre binds each channel to the identity that created it and 403s any PUT
// from another identity. We hit this when a channel was opened before login
// (as a guest) and reused after, or after a session change. The channel id is
// unrecoverable; mint a new one so the caller's retry lands on a fresh channel.
function isChannelIdentityMismatch(err: unknown): err is ChannelPutError {
  return err instanceof ChannelPutError && err.status === 403;
}

function rotateChannel(client: Urbit, context: string) {
  logger.log('rotating channel', context);
  logger.trackEvent(AnalyticsEvent.NodeConnectionDebug, {
    context: 'channel rotated',
    reason: context,
  });
  client.seamlessReset();
}

// What a request saw when it went out. Several requests fail together when a
// channel or session dies, and only the first one to come back should fix it;
// the rest just retry against whatever the fix produced. `session` is the
// account the request went out for; a resolver-provided client owns its own
// auth and has none.
interface SendContext {
  session: Session | null;
  authEpoch: number;
  channelId: string | undefined;
}

function captureSendContext(client: Urbit | null): SendContext {
  const current = config.session;
  const session = current && client === current.client ? current : null;
  return {
    session,
    authEpoch: session?.authEpoch ?? 0,
    channelId: client?.channelId,
  };
}

// Seconds since the current channel id was minted. The uid is
// `<unix seconds>-<random>`, so this needs no new state -- but it is the age
// of the id, not of a connection: the id is minted when the client is
// constructed, well before anything is sent on the channel, and a rotation
// between the failing send and this report restarts the clock. Only the age is
// reported; the uid itself is an identifier and stays out of analytics.
function channelAgeSeconds(client: Urbit | null): number | undefined {
  const opened = Number(client?.channelId?.split('-')[0]);
  return Number.isFinite(opened) && opened > 0
    ? Math.max(0, Math.round(Date.now() / 1000 - opened))
    : undefined;
}

function rotateChannelOnce(client: Urbit, sent: SendContext, context: string) {
  if (sent.channelId !== undefined && client.channelId !== sent.channelId) {
    logger.log('channel already rotated, retrying', context);
    return;
  }
  rotateChannel(client, context);
}

// Did a login actually complete since the request went out? Only an epoch
// advance proves that. A channel that merely rotated does not: an SSE reap or
// 500 rotates it without authenticating anything.
function sessionRefreshedSince(sent: SendContext) {
  return sent.session !== null && sent.session.authEpoch !== sent.authEpoch;
}

async function reauthOnce(sent: SendContext) {
  if (!sent.session) {
    throw new Error('Client not initialized');
  }
  if (sent.session.authEpoch !== sent.authEpoch) {
    logger.log('session already refreshed, retrying');
    return;
  }
  await reauth(sent.session);
}

export async function subscribe<T>(
  endpoint: UrbitEndpoint,
  handler: (update: T, id?: number) => void
): Promise<number> {
  // the account this is for. As in poke, the send and any retry go to it,
  // never to an account that replaced it mid-flight
  const session = config.session;
  let sent = captureSendContext(config.client);
  const doSub = async (err?: (error: any, id: string) => void) => {
    if (!session) {
      throw new Error('Client not initialized');
    }
    if (session.pendingAuth) {
      await session.pendingAuth;
    }
    logger.log('subscribing to', printEndpoint(endpoint));
    sent = captureSendContext(session.client);
    return session.client.subscribe({
      app: endpoint.app,
      path: endpoint.path,
      event: (event: any, mark: string, id?: number) => {
        logger.debug(
          `got subscription event on ${printEndpoint(endpoint)}:`,
          event
        );

        // first check if anything is watching the subscription for
        // tracked pokes
        const endpointKey = printEndpoint(endpoint);
        const endpointWatchers = config.subWatchers[endpointKey];
        logger.debug(
          `checking for endpoint watchers on ${endpointKey}:`,
          endpointWatchers
        );
        if (endpointWatchers) {
          endpointWatchers.forEach((watcher) => {
            if (watcher.predicate(event, mark)) {
              logger.debug(`watcher ${watcher.id} predicate met`, event);
              watcher.resolve();
              endpointWatchers.delete(watcher.id);
            } else {
              logger.debug(`watcher ${watcher.id} predicate failed`, event);
            }
          });
        }

        // then pass the event along to the subscription handler
        handler(event, id);
      },
      quit: () => {
        logger.log('subscription quit on', printEndpoint(endpoint));
        config.onQuitOrReset?.('subscriptionQuit', printEndpoint(endpoint));
      },
      err: (error, id) => {
        logger.trackError('subscribe error', {
          ...describeError(error),
          endpoint: printEndpoint(endpoint),
        });

        if (err) {
          logger.log(
            'calling error handler for subscription',
            printEndpoint(endpoint)
          );
          err(error, id);
        }
      },
    });
  };

  const retry = async (err: any) => {
    logger.error('bad subscribe', printEndpoint(endpoint), err);
    // the account this went out for has since been replaced; the rotation,
    // the login and the resubscribe below would all land on the new one
    if (!session || session !== config.session) {
      throw err;
    }
    if (isChannelIdentityMismatch(err)) {
      rotateChannelOnce(
        session.client,
        sent,
        `subscribe ${printEndpoint(endpoint)}`
      );
      return doSub(retry);
    }
    if (!(err instanceof AuthError)) {
      throw err;
    }

    await reauthOnce(sent);
    // keep the err handler wired so the re-established subscription can
    // recover from a later auth death the same way the initial one does
    return doSub(retry);
  };

  try {
    return await doSub(retry);
  } catch (err) {
    return retry(err);
  }
}

export async function subscribeOnce<T>(
  endpoint: UrbitEndpoint,
  timeout?: number,
  ship?: string,
  requestConfig?: { tag?: string }
) {
  if (!config.client) {
    throw new Error('Client not initialized');
  }
  if (config.session?.pendingAuth) {
    await config.session.pendingAuth;
  }
  logger.log('subscribing once to', printEndpoint(endpoint));

  // Both the first attempt and the post-reauth retry go through here, so a
  // retry reports the same telemetry the first attempt would. `return await`,
  // not `return`: returning the promise hands it out of the try before it
  // settles, which is why none of this reporting ever ran.
  const attempt = async (isRetry: boolean): Promise<T> => {
    const session = config.session;
    if (!session) {
      throw new Error('Client not initialized');
    }
    const { client } = session;
    const sent = captureSendContext(client);
    try {
      const result = await client.subscribeOnce<T>(
        endpoint.app,
        endpoint.path,
        ship,
        timeout
      );
      if (isRetry) {
        // the reauth earned its keep; counted in PostHog rather than reported
        // as an error, since the caller never saw a failure
        logger.trackEvent(AnalyticsEvent.SubscribeOnceRecovered, {
          requestTag: requestConfig?.tag,
          subEndpoint: printEndpoint(endpoint),
        });
      }
      return result;
    } catch (err) {
      // Never retry for an account that is no longer the configured one. A
      // logout or account switch can replace it while this request is still
      // in flight, and attempt() reads the configured session — so a retry
      // would replay this endpoint against a different ship's session.
      const willRetry =
        !isRetry && err instanceof AuthError && config.session === session;

      // Only report once we know the caller is actually going to see a
      // failure. A first attempt that recovers on retry was never visible to
      // the user, and reporting it would fill Sentry with errors that did not
      // happen from their point of view.
      const reportTerminalFailure = () => {
        if (err !== 'timeout' && err !== 'quit') {
          logger.trackError('bad subscribeOnce', {
            ...describeError(err),
            endpoint: printEndpoint(endpoint),
            isRetry,
          });
        } else if (err === 'timeout') {
          logger.error('subscribeOnce timed out', printEndpoint(endpoint));
          logger.trackEvent(AnalyticsEvent.ErrorSubscribeOnceTimeout, {
            requestTag: requestConfig?.tag,
            subEndpoint: printEndpoint(endpoint),
            connectionStatus: config.lastStatus,
            timeoutDuration: timeout,
            isRetry,
          });
        } else {
          logger.error('subscribeOnce quit', printEndpoint(endpoint), {
            isRetry,
          });
        }
      };

      // isRetry bounds this to a single extra round trip
      if (!willRetry) {
        reportTerminalFailure();
        throw err;
      }

      logger.log('subscribeOnce retrying after auth', printEndpoint(endpoint));

      // reauthOnce, not reauth: matches subscribe/poke/scry. A bare reauth()
      // would start a second login for every caller that failed against the
      // same dead session, and eyre closes the session each login arrives
      // with.
      try {
        await reauthOnce(sent);
      } catch (reauthErr) {
        // reauth can throw outright — no getCode and no failure handler, or a
        // login that exhausted its attempts. Report the failure the caller
        // actually asked about before the reauth error replaces it, or both
        // go unreported.
        reportTerminalFailure();
        throw reauthErr;
      }
      // reauthOnce resolves without having refreshed anything when we are
      // logging out, when there is no getCode, or when the ship rejected the
      // code. Retrying then just fires at a session already known to be dead,
      // and on mobile races the forced-logout alert. Only an epoch advance
      // proves a login completed.
      if (session.loggingOut || !sessionRefreshedSince(sent)) {
        reportTerminalFailure();
        throw err;
      }
      // the account can be swapped out while we await above, and attempt()
      // reads whichever one is configured
      if (config.session !== session) {
        reportTerminalFailure();
        throw err;
      }
      return attempt(true);
    }
  };

  return attempt(false);
}

export async function unsubscribe(id: number) {
  if (!config.client) {
    throw new Error('Client not initialized');
  }
  if (config.session?.pendingAuth) {
    await config.session.pendingAuth;
  }
  // See subscribeOnce: `return` handed the promise out of the try, so this
  // catch never ran and the AuthError retry it contained was dead code.
  try {
    return await config.client.unsubscribe(id);
  } catch (err) {
    logger.error('bad unsubscribe', id, err);
    // Deliberately no reauth-and-retry, unlike the other verbs. A successful
    // reauth rotates the channel (performReauth -> rotateChannel ->
    // seamlessReset), which resets lastEventId to 0 and replays outstanding
    // subscriptions under freshly allocated ids. `id` would then be stale and
    // could well name a *different* subscription, so retrying risks
    // unsubscribing the wrong one. No retry happened here before either --
    // the catch was unreachable -- so rethrowing keeps today's behavior and
    // only makes the logging live.
    throw err;
  }
}

export async function pokeNoun<T>({ app, mark, noun }: NounPokeParams) {
  const session = config.session;
  let sent = captureSendContext(config.client);
  const doPoke = async (params?: Partial<NounPokeInterface>) => {
    if (!session) {
      throw new Error('Client not initialized');
    }
    if (session.pendingAuth) {
      await session.pendingAuth;
    }
    logger.log('noun poke', { app, mark });
    sent = captureSendContext(session.client);
    return session.client.pokeNoun({
      ...params,
      app,
      mark,
      noun,
    });
  };
  const fail = (err: any) => {
    logger.trackError('bad noun poke', {
      ...describeError(err),
      app,
      mark,
    });
    throw err;
  };
  const retry = async (err: any) => {
    // as in poke: not retried once the account it went out for is gone
    if (!session || session !== config.session) {
      return fail(err);
    }
    if (isChannelIdentityMismatch(err)) {
      rotateChannelOnce(session.client, sent, `noun poke ${app}/${mark}`);
    } else if (err instanceof AuthError) {
      await reauthOnce(sent);
    } else {
      // a ReapError here may mean the ship already took the poke; don't resend
      return fail(err);
    }
    try {
      return await doPoke();
    } catch (retryErr) {
      return fail(retryErr);
    }
  };

  try {
    // the http-api client rejects the promise on failure, so a separate
    // onError handler would run the retry a second time
    return await doPoke();
  } catch (err) {
    return retry(err);
  }
}

export async function poke({ app, mark, json }: PokeParams) {
  logger.log('poke', app, mark, json);
  const trackDuration = createDurationTracker(AnalyticsEvent.Poke, {
    app,
    mark,
  });
  const activeClient = resolveClient();
  let sent = captureSendContext(activeClient);
  const startEpoch = sent.authEpoch;
  const doPoke = async () => {
    if (!activeClient) {
      throw new Error('Client not initialized');
    }
    if (activeClient === config.client && config.session?.pendingAuth) {
      await config.session.pendingAuth;
    }
    sent = captureSendContext(activeClient);
    return activeClient.poke({ app, mark, json });
  };
  const fail = (err: any) => {
    const session = config.session;
    logger.trackError('bad poke', {
      ...describeError(err),
      app,
      mark,
      // `AuthError: invalid session` carries no status and no session context.
      errorStatus:
        typeof err?.status === 'number'
          ? err.status
          : typeof err?.responseStatus === 'number'
            ? err.responseStatus
            : undefined,
      channelOpened: activeClient?.channelOpened,
      channelAgeSeconds: channelAgeSeconds(activeClient),
      // A resolver-provided client owns its own auth, so the configured
      // session describes the singleton rather than the client that failed;
      // report it only when they are the same client. `authEpoch` counts
      // reauths that completed for this account -- including one another
      // caller started and this poke merely waited on -- and counts neither
      // failed attempts nor the initial connect(), so 0 means no login has
      // ever completed for it. `reauthsDuringPoke` narrows that to the ones
      // this call spanned.
      ...(session && activeClient === session.client
        ? {
            authEpoch: session.authEpoch,
            reauthsDuringPoke: session.authEpoch - startEpoch,
            reauthInFlight: session.pendingAuth !== null,
            connectionStatus: config.lastStatus,
          }
        : {}),
    });
    trackDuration('error');
    throw err;
  };
  const retry = async (err: any) => {
    // scoped (non-singleton) clients own their own auth; don't touch them
    if (!activeClient || activeClient !== config.client) {
      return fail(err);
    }
    if (isChannelIdentityMismatch(err)) {
      rotateChannelOnce(activeClient, sent, `poke ${app}/${mark}`);
    } else if (err instanceof AuthError) {
      await reauthOnce(sent);
    } else {
      // this includes a ReapError from a rotation that swept the poke while
      // its PUT was in flight: the ship may have taken it, so it must not be
      // sent again here. the caller decides whether to retry.
      return fail(err);
    }
    try {
      return await doPoke();
    } catch (retryErr) {
      return fail(retryErr);
    }
  };

  try {
    const result = await doPoke();
    trackDuration('success');
    return result;
  } catch (err) {
    const result = await retry(err);
    trackDuration('success');
    return result;
  }
}

export async function trackedPoke<T, R = T>(
  params: PokeParams,
  endpoint: UrbitEndpoint,
  predicate: (event: R) => boolean,
  requestConfig?: { tag?: string; timeout?: number }
) {
  if (config.session?.pendingAuth) {
    await config.session.pendingAuth;
  }
  const trackDuration = createDurationTracker(AnalyticsEvent.TrackedPoke, {
    app: params.app,
    mark: params.mark,
  });
  let pokeCompleted = false;
  try {
    const tracking = track(
      endpoint,
      predicate,
      requestConfig?.timeout ?? 20000
    );
    const poking = poke(params).then(() => (pokeCompleted = true));
    await Promise.all([tracking, poking]);
    trackDuration('success');
  } catch (e) {
    logger.error(`tracked poke failed`, e);
    trackDuration('error');
    if (e instanceof TimeoutError) {
      logger.trackEvent(AnalyticsEvent.ErrorTrackedPokeTimeout, {
        requestTag: requestConfig?.tag,
        pokeParams: params,
        subEndpoint: printEndpoint(endpoint),
        connectionStatus: config.lastStatus,
        timeoutDuration: e.timeoutDuration,
        pokeCompleted,
      });
    }
    throw e;
  }
}

export async function trackedPokeNoun<T, R = T>(
  params: NounPokeParams,
  endpoint: UrbitEndpoint,
  predicate: (event: R) => boolean,
  requestConfig?: { tag: string; timeout?: number }
) {
  if (config.session?.pendingAuth) {
    await config.session.pendingAuth;
  }
  const trackDuration = createDurationTracker(AnalyticsEvent.TrackedPoke, {
    app: params.app,
    mark: params.mark,
  });
  let pokeCompleted = false;
  try {
    const tracking = track(
      endpoint,
      predicate,
      requestConfig?.timeout ?? 20000
    );
    const poking = pokeNoun(params).then(() => (pokeCompleted = true));
    await Promise.all([tracking, poking]);
    trackDuration('success');
  } catch (e) {
    logger.error(`tracked poke failed`, e);
    trackDuration('error');
    if (e instanceof TimeoutError) {
      logger.trackEvent(AnalyticsEvent.ErrorTrackedPokeTimeout, {
        requestTag: requestConfig?.tag,
        pokeParams: params,
        subEndpoint: printEndpoint(endpoint),
        connectionStatus: config.lastStatus,
        timeoutDuration: e.timeoutDuration,
        pokeCompleted,
      });
    }
    throw e;
  }
}

async function track<R>(
  endpoint: UrbitEndpoint,
  predicate: (event: R) => boolean,
  timeout = 15000
) {
  const endpointKey = printEndpoint(endpoint);
  return new Promise((resolve, reject) => {
    const watchers = config.subWatchers[endpointKey] || new Map();
    const id = _.uniqueId();

    config.subWatchers[endpointKey] = watchers.set(id, {
      id,
      predicate,
      resolve,
      reject,
    });

    if (timeout) {
      setTimeout(() => {
        if (watchers.has(id)) {
          watchers.delete(id);
          reject(
            new TimeoutError({
              connectionStatus: config.lastStatus,
              timeoutDuration: timeout,
            })
          );
        }
      }, timeout);
    }
  });
}

export type SpinErrorClass =
  | 'timeout'
  | 'http_4xx'
  | 'http_5xx'
  | 'content_type'
  | 'closed'
  | 'transport'
  | 'aborted'
  | 'other';

export type SpinHintResult =
  | {
      outcome: 'hint';
      nodeBusyStatus: 'available' | 'busy';
      hints?: string;
      durationMs: number;
    }
  | {
      outcome: 'grace_expired';
      nodeBusyStatus: 'unknown';
      durationMs: number;
    }
  | {
      outcome: 'failed';
      nodeBusyStatus: 'unknown';
      errorClass: SpinErrorClass;
      durationMs: number;
    }
  | {
      outcome: 'unavailable';
      nodeBusyStatus: 'unknown';
      durationMs: 0;
    };

export type SpinHintCheck = {
  settleWithin(graceMs: number): Promise<SpinHintResult>;
  cancel(): void;
};

function classifySpinError(error: unknown): SpinErrorClass {
  if (
    error instanceof SSETimeoutError ||
    (error instanceof Error && error.message === 'getBytes timed out')
  ) {
    return 'timeout';
  }
  if (error instanceof ReapError) {
    return 'http_4xx';
  }
  if (error instanceof SSEBadResponseError) {
    if (error.status >= 400 && error.status < 500) {
      return 'http_4xx';
    }
    if (error.status >= 500 && error.status < 600) {
      return 'http_5xx';
    }
  }
  if (
    error instanceof Error &&
    error.message.startsWith('Expected content-type to be text/event-stream')
  ) {
    return 'content_type';
  }
  if (error instanceof SpinClosedError) {
    return 'closed';
  }
  if (
    error instanceof SpinAbortedError ||
    (error instanceof Error && error.name === 'AbortError')
  ) {
    return 'aborted';
  }
  if (
    error instanceof TypeError ||
    (error instanceof Error &&
      /fetch|network|connection|socket|host/i.test(
        `${error.name} ${error.message}`
      ))
  ) {
    return 'transport';
  }
  return 'other';
}

export function startSpinHintCheck(): SpinHintCheck {
  const startedAt = Date.now();
  const controller = new AbortController();
  const activeClient = resolveClient();
  let terminalResult: SpinHintResult | undefined;
  let graceTimer: ReturnType<typeof setTimeout> | undefined;

  const settle = (result: SpinHintResult): SpinHintResult => {
    terminalResult ??= result;
    return terminalResult;
  };

  let resultPromise: Promise<SpinHintResult>;
  if (!activeClient) {
    resultPromise = Promise.resolve(
      settle({
        outcome: 'unavailable',
        nodeBusyStatus: 'unknown',
        durationMs: 0,
      })
    );
  } else {
    try {
      resultPromise = Promise.resolve(
        activeClient.getSpinHints({ signal: controller.signal })
      ).then(
        (hints) =>
          settle({
            outcome: 'hint',
            nodeBusyStatus: hints === '/root' ? 'available' : 'busy',
            ...(hints === '/root' ? {} : { hints }),
            durationMs: Date.now() - startedAt,
          }),
        (error) =>
          settle({
            outcome: 'failed',
            nodeBusyStatus: 'unknown',
            errorClass: classifySpinError(error),
            durationMs: Date.now() - startedAt,
          })
      );
    } catch (error) {
      resultPromise = Promise.resolve(
        settle({
          outcome: 'failed',
          nodeBusyStatus: 'unknown',
          errorClass: classifySpinError(error),
          durationMs: Date.now() - startedAt,
        })
      );
    }
  }

  return {
    async settleWithin(graceMs) {
      if (terminalResult) {
        return terminalResult;
      }

      const graceResult = new Promise<SpinHintResult>((resolve) => {
        graceTimer = setTimeout(() => {
          const result = settle({
            outcome: 'grace_expired',
            nodeBusyStatus: 'unknown',
            durationMs: Date.now() - startedAt,
          });
          controller.abort();
          resolve(result);
        }, graceMs);
      });

      try {
        return await Promise.race([resultPromise, graceResult]);
      } finally {
        clearTimeout(graceTimer);
        graceTimer = undefined;
      }
    },
    cancel() {
      clearTimeout(graceTimer);
      graceTimer = undefined;
      controller.abort();
    },
  };
}

export async function scry<T>({
  app,
  path,
  timeout,
}: {
  app: string;
  path: string;
  timeout?: number;
}) {
  const activeClient = resolveClient();
  if (!activeClient) {
    throw new Error('Client not initialized');
  }
  if (activeClient === config.client && config.session?.pendingAuth) {
    await config.session.pendingAuth;
  }
  logger.log('scry', app, path);
  const trackDuration = createDurationTracker(AnalyticsEvent.Scry, {
    app,
    path: redactPath(path),
    shouldTimeoutAfter: timeout ?? DEFAULT_SCRY_TIMEOUT,
  });
  const sent = captureSendContext(activeClient);
  try {
    const { result, responseSizeInBytes, responseStatus } =
      await activeClient.scryWithInfo<T>({
        app,
        path,
        timeout: timeout ?? DEFAULT_SCRY_TIMEOUT,
      });
    trackDuration('success', { responseSizeInBytes, responseStatus });
    return result;
  } catch (res) {
    logger.log('bad scry', app, path, res.status);
    if (res.status === 403 && activeClient === config.client) {
      logger.log('scry failed with 403, authing to try again');
      await reauthOnce(sent);
      const { result, responseSizeInBytes, responseStatus } =
        await activeClient.scryWithInfo<T>({
          app,
          path,
          // Same bound as the first attempt: an un-timed retry has nothing to
          // abort it, so a hung one never settles and holds its caller — and,
          // for queued work, its sync queue thread — forever.
          timeout: timeout ?? DEFAULT_SCRY_TIMEOUT,
        });
      trackDuration('success', { responseSizeInBytes, responseStatus });
      return result;
    }
    trackDuration('error', {
      errorMessage: res.message,
      responseStatus: res.status,
    });
    throw new BadResponseError(res.status, await responseErrorBody(res));
  }
}

export interface RequestJsonOptions {
  reauthStatuses?: readonly number[];
  signal?: AbortSignal;
}

// Authenticated JSON request to an arbitrary ship path. Reauths once on 403 by
// default; callers may opt into additional auth statuses for their endpoint.
export async function requestJson<T = any>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
  body?: unknown,
  options: RequestJsonOptions = {}
): Promise<T> {
  const activeClient = resolveClient();
  if (!activeClient) {
    throw new Error('Client not initialized');
  }
  if (activeClient === config.client && config.session?.pendingAuth) {
    await config.session.pendingAuth;
  }
  const reauthStatuses = options.reauthStatuses ?? [403];
  const sent = captureSendContext(activeClient);
  const send = () =>
    options.signal
      ? activeClient.requestJson<T>(path, method, body, {
          signal: options.signal,
        })
      : activeClient.requestJson<T>(path, method, body);

  try {
    return await send();
  } catch (res) {
    if (options.signal?.aborted || res?.name === 'AbortError') {
      throw res;
    }
    if (
      activeClient === config.client &&
      reauthStatuses.includes(res?.status)
    ) {
      await reauthOnce(sent);
      return await send();
    }
    const errorBody = await responseErrorBody(res);
    throw new BadResponseError(res?.status ?? 0, errorBody);
  }
}

// Reading a rejected response's body is purely diagnostic, and the request's
// own timeout is already disarmed by the time the rejection reaches us
// (`scryWithInfo` cleans its signal up in a `finally`), so an unbounded read
// would hang a scry that had already failed. Give the read its own deadline
// and settle for an empty body when it expires.
const ERROR_BODY_READ_TIMEOUT = 5000;

async function responseErrorBody(res: any): Promise<string> {
  if (typeof res?.text === 'function') {
    try {
      return await readWithin(res.text(), ERROR_BODY_READ_TIMEOUT);
    } catch {
      // Fall through to the generic cases below.
    }
  }
  if (typeof res?.body === 'string') return res.body;
  if (typeof res?.message === 'string') return res.message;
  const text = String(res);
  return text === '[object Response]' ? '' : text;
}

// Resolves with whatever `read` produces, or with an empty body once `ms`
// elapses. The abandoned read stays attached to the race, so a late rejection
// is never unhandled.
function readWithin(read: Promise<string>, ms: number): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(''), ms);
  });
  return Promise.race([read, deadline]).finally(() => clearTimeout(timer));
}

export async function scryNoun({
  app,
  path,
  timeout,
}: {
  app: string;
  path: string;
  timeout?: number;
}) {
  const session = config.session;
  if (!session) {
    throw new Error('Client not initialized');
  }
  if (session.pendingAuth) {
    await session.pendingAuth;
  }
  logger.log('scry noun', app, path);
  const trackDuration = createDurationTracker(AnalyticsEvent.ScryNoun, {
    app,
    path: redactPath(path),
    shouldTimeoutAfter: timeout ?? DEFAULT_SCRY_TIMEOUT,
  });
  const sent = captureSendContext(session.client);
  try {
    const { result, responseSizeInBytes, responseStatus } =
      await session.client.scryNounWithInfo({
        app,
        path,
        timeout: timeout ?? DEFAULT_SCRY_TIMEOUT,
      });
    trackDuration('success', { responseSizeInBytes, responseStatus });
    return result;
  } catch (res) {
    logger.log('bad scry', app, path, res.status);
    // as in scry: no login and no retry for an account that has been replaced
    if (res.status === 403 && session === config.session) {
      logger.log('scry failed with 403, authing to try again');
      await reauthOnce(sent);
      const { result, responseSizeInBytes, responseStatus } =
        // Bounded like the first attempt, for the reason given on scry above.
        await session.client.scryNounWithInfo({
          app,
          path,
          timeout: timeout ?? DEFAULT_SCRY_TIMEOUT,
        });
      trackDuration('success', { responseSizeInBytes, responseStatus });
      return result;
    }
    trackDuration('error', {
      message: res.message,
      responseStatus: res.status,
    });
    throw new BadResponseError(res.status, await responseErrorBody(res));
  }
}

export async function thread<T, R = any>(params: Thread<T>): Promise<R> {
  if (!params.desk) {
    throw new Error('Must supply desk to run thread from');
  }

  if (!config.client) {
    throw new Error('Cannot call thread before client is initialized');
  }

  const trackDuration = createDurationTracker(AnalyticsEvent.Thread, {
    desk: params.desk,
    inputMark: params.inputMark,
    threadName: params.threadName,
    outputMark: params.outputMark,
    shouldTimeoutAfter: params.timeout ?? DEFAULT_THREAD_TIMEOUT,
  });
  const requestContext: any = {};

  try {
    const response = await config.client.thread<T>({
      ...params,
      timeout: params.timeout ?? DEFAULT_THREAD_TIMEOUT,
    });
    if (!response.ok) {
      const errorText = await response.text();
      requestContext.responseStatus = response.status;
      requestContext.responseText = errorText;
      throw new BadResponseError(response.status, errorText);
    }

    trackDuration('success');
    return response.json();
  } catch (err) {
    trackDuration('error', { ...requestContext, errorMessage: err.toString() });
    throw err;
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  timeout?: number
) {
  if (!config.client) {
    throw new Error('Cannot make request before client is initialized');
  }

  return config.client.request<T>(path, options, timeout);
}

// Remove any identifiable information from path
// ~solfer-magfed/my-group => [id]/my-group
// chat/~solfer-magfed/my-channel/ => chat/[id]/
// ~solfer-magfed/ => [id]/
function redactPath(path: string) {
  return path.replace(/~.+?(?:\/.+?)(\/|$)/g, '[id]/');
}

// The account a login was started for is no longer the configured one.
// Nothing that follows may act on the account that replaced it.
function abandonIfSwapped(session: Session) {
  if (config.session === session) {
    return;
  }
  logger.log('client changed during reauth, abandoning');
  throw new Error('Error during reauth: client changed');
}

async function reauth(session: Session) {
  // the callers refuse to retry for a replaced account; this refuses to log
  // one in, so no caller can start a login -- or fetch a code -- for it
  abandonIfSwapped(session);

  if (session.loggingOut) {
    return;
  }

  if (!session.getCode) {
    logger.log('No getCode function provided for auth');
    if (session.handleAuthFailure) {
      logger.log('calling auth failure handler');
      return session.handleAuthFailure({ mustLogout: false });
    }

    throw new Error('Unable to authenticate with urbit');
  }

  // Dedupe synchronously, before anything is awaited: every caller that shows
  // up while a reauth is in flight shares it. Concurrent logins are actively
  // harmful, since eyre closes the session a login request arrives with, so
  // parallel logins invalidate each other and all but one come back 401. The
  // login belongs to the session, so a new account neither joins nor waits
  // on one the old account still has running.
  if (!session.pendingAuth) {
    session.pendingAuth = performReauth(session).finally(() => {
      session.pendingAuth = null;
    });
  }
  return session.pendingAuth;
}

const MAX_LOGIN_ATTEMPTS = 4;

async function performReauth(session: Session): Promise<string | void> {
  // Everything here belongs to the account we started for: the code, the ship
  // we post it to, and the client the cookie lands on. A logout or account
  // switch can land on any await below and replace the session out from under
  // us, and once it has, nothing that follows is the new account's business --
  // not the login request, not the cookie, not `loggingOut`, not its failure
  // handler. Abandon.
  let code: string;
  try {
    logger.log('getting urbit code');
    code = await session.getCode!();
  } catch (e) {
    abandonIfSwapped(session);
    logger.error('error getting urbit code', e);
    if (session.handleAuthFailure) {
      return session.handleAuthFailure({ mustLogout: false });
    }
    throw e;
  }

  for (let attempt = 0; ; attempt++) {
    // a swap during the code fetch or the backoff: stop before the request is
    // even sent
    abandonIfSwapped(session);
    const lastAttempt = attempt >= MAX_LOGIN_ATTEMPTS - 1;
    let authCookie: string | undefined;
    let failure: { error: unknown } | undefined;
    try {
      logger.log('trying to auth with code', code);
      authCookie = await getLandscapeAuthCookie(session.shipUrl, code);
    } catch (e) {
      failure = { error: e };
    }
    // the request is a window of its own, so re-check before anything acts on
    // the result -- the success path and every branch of the failure handling
    // below all touch the account's client and hooks
    abandonIfSwapped(session);

    if (failure) {
      const e = failure.error;
      if (e instanceof AuthFailureError && e.responseStatus === 400) {
        // the code itself was rejected; no retry will fix that, so log out
        session.loggingOut = true;
        session.handleAuthFailure?.({ mustLogout: true });
        return;
      }
      // a 401 means the request carried a session cookie the ship no longer
      // recognizes; the response expires it, so a retry can go through clean
      const staleCookie =
        e instanceof AuthFailureError && e.responseStatus === 401;
      // a 5xx is the ship failing to answer, not a verdict on our credentials,
      // and anything that isn't an AuthFailureError means fetch itself
      // rejected -- we have no response to judge, though the ship may well
      // have received the request. Both can come good on the next attempt;
      // every other 4xx is a refusal that a retry will only repeat.
      const transient =
        e instanceof AuthFailureError ? e.responseStatus >= 500 : true;
      if (!(staleCookie || transient) || lastAttempt) {
        if (staleCookie && session.handleAuthFailure) {
          // we are out of retries with a cookie the ship keeps rejecting; let
          // the app decide what an unrecoverable session means for it
          logger.log('auth failed, calling auth failure handler');
          session.handleAuthFailure({ mustLogout: false });
        }
        // keep the original as `cause`: the message stringifies it, but error
        // reporting classifies failures by the status field, which a bare
        // rethrow would drop
        throw new Error(`Error during reauth: ${e}`, { cause: e });
      }
    }

    if (authCookie) {
      session.authEpoch += 1;
      session.client.cookie = authCookie;
      // logging in moved us to a new session. any channel we opened under
      // the old one is either gone (eyre closed the old session's channels)
      // or bound to an identity that is no longer ours, so start fresh
      // before waiters retry against it
      if (session.client.channelOpened) {
        rotateChannel(session.client, 'reauth');
      }
      return authCookie;
    }

    if (lastAttempt) {
      if (session.handleAuthFailure) {
        logger.log('auth failed, calling auth failure handler');
        session.handleAuthFailure({ mustLogout: false });
      }
      throw new Error("Couldn't authenticate with urbit");
    }
    logger.log('auth failed, trying again', attempt);
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + 2 ** (attempt + 1) * 1000)
    );
  }
}

function createDurationTracker<T extends Record<string, any>>(
  event: AnalyticsEvent,
  data: T
) {
  const startTime = Date.now();
  return (status: 'success' | 'error', properties?: Record<string, any>) => {
    logger.trackEvent(event, {
      ...data,
      ...properties,
      status,
      scryStatus: status,
      duration: Date.now() - startTime,
    });
  };
}
