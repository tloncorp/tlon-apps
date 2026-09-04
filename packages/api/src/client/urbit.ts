import { Noun } from '@urbit/nockjs';
import _ from 'lodash';

import {
  AuthError,
  ChannelPutError,
  ChannelStatus,
  NounPokeInterface,
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

interface Config extends Pick<
  ClientParams,
  'getCode' | 'handleAuthFailure' | 'shipUrl' | 'onQuitOrReset'
> {
  client: Urbit | null;
  subWatchers: Watchers;
  pendingAuth: Promise<string | void> | null;
  // bumped on every successful reauth so a request that failed while a
  // reauth was already in flight can retry without starting another one
  authEpoch: number;
  loggingOut: boolean;
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
  client: null,
  lastStatus: '',
  shipUrl: '',
  subWatchers: {},
  pendingAuth: null,
  authEpoch: 0,
  loggingOut: false,
  onQuitOrReset: undefined,
  getCode: undefined,
  handleAuthFailure: undefined,
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
  config.client =
    injectedClient || config.client || new Urbit(shipUrl, '', '', fetchFn);
  config.client.verbose = verbose;
  config.client.nodeId = preSig(shipName);
  config.shipUrl = shipUrl;
  // a fresh configuration is a fresh session; a forced logout on the previous
  // one must not leave reauth disabled for this one
  config.loggingOut = false;
  config.onQuitOrReset = onQuitOrReset;
  config.getCode = getCode;
  config.handleAuthFailure = handleAuthFailure;
  config.subWatchers = {};

  // the below event handlers will only fire if verbose is set to true
  config.client.on('status-update', (event) => {
    logger.trackEvent(AnalyticsEvent.NodeConnectionDebug, {
      context: 'status update',
      connectionStatus: event.status,
      statusUpdateContext: event.context ? event.context : null,
    });
    config.lastStatus = event.status;
    onChannelStatusChange?.(event.status);
  });

  config.client.on('fact', (fact) => {
    logger.log(
      'received message',
      runIfDev(() => escapeLog(JSON.stringify(fact)))
    );
  });

  config.client.on('seamless-reset', () => {
    logger.log('client seamless-reset');
    logger.trackEvent(AnalyticsEvent.NodeConnectionDebug, {
      context: 'seamless-reset',
    });
    config.onQuitOrReset?.('reset');
  });

  config.client.on('error', (error) => {
    logger.log('client error', error);
  });

  config.client.on('channel-reaped', () => {
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

export function internalRemoveClient() {
  config.client?.delete();
  config.client = null;
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
// the rest just retry against whatever the fix produced.
interface SendContext {
  authEpoch: number;
  channelId: string | undefined;
}

function captureSendContext(client: Urbit | null): SendContext {
  return { authEpoch: config.authEpoch, channelId: client?.channelId };
}

function rotateChannelOnce(client: Urbit, sent: SendContext, context: string) {
  if (sent.channelId !== undefined && client.channelId !== sent.channelId) {
    logger.log('channel already rotated, retrying', context);
    return;
  }
  rotateChannel(client, context);
}

async function reauthOnce(sent: SendContext) {
  if (config.authEpoch !== sent.authEpoch) {
    logger.log('session already refreshed, retrying');
    return;
  }
  await reauth();
}

export async function subscribe<T>(
  endpoint: UrbitEndpoint,
  handler: (update: T, id?: number) => void
): Promise<number> {
  let sent = captureSendContext(config.client);
  const doSub = async (err?: (error: any, id: string) => void) => {
    if (!config.client) {
      throw new Error('Client not initialized');
    }
    if (config.pendingAuth) {
      await config.pendingAuth;
    }
    logger.log('subscribing to', printEndpoint(endpoint));
    sent = captureSendContext(config.client);
    return config.client.subscribe({
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
        logger.trackError(
          `subscribe error on ${printEndpoint(endpoint)}`,
          describeError(error)
        );

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
    if (config.client && isChannelIdentityMismatch(err)) {
      rotateChannelOnce(
        config.client,
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
  if (config.pendingAuth) {
    await config.pendingAuth;
  }
  logger.log('subscribing once to', printEndpoint(endpoint));
  try {
    return config.client.subscribeOnce<T>(
      endpoint.app,
      endpoint.path,
      ship,
      timeout
    );
  } catch (err) {
    if (err !== 'timeout' && err !== 'quit') {
      logger.trackError(`bad subscribeOnce ${printEndpoint(endpoint)}`, {
        ...describeError(err),
      });
    } else if (err === 'timeout') {
      logger.error('subscribeOnce timed out', printEndpoint(endpoint));
      logger.trackEvent(AnalyticsEvent.ErrorSubscribeOnceTimeout, {
        requestTag: requestConfig?.tag,
        subEndpoint: printEndpoint(endpoint),
        connectionStatus: config.lastStatus,
        timeoutDuration: timeout,
      });
    } else {
      logger.error('subscribeOnce quit', printEndpoint(endpoint));
    }

    if (!(err instanceof AuthError)) {
      throw err;
    }

    await reauth();
    return config.client.subscribeOnce<T>(
      endpoint.app,
      endpoint.path,
      ship,
      timeout
    );
  }
}

export async function unsubscribe(id: number) {
  if (!config.client) {
    throw new Error('Client not initialized');
  }
  if (config.pendingAuth) {
    await config.pendingAuth;
  }
  try {
    return config.client.unsubscribe(id);
  } catch (err) {
    logger.error('bad unsubscribe', id, err);
    if (err instanceof AuthError) {
      await reauth();
      return config.client.unsubscribe(id);
    }
  }
}

export async function pokeNoun<T>({ app, mark, noun }: NounPokeParams) {
  let sent = captureSendContext(config.client);
  const doPoke = async (params?: Partial<NounPokeInterface>) => {
    if (!config.client) {
      throw new Error('Client not initialized');
    }
    if (config.pendingAuth) {
      await config.pendingAuth;
    }
    logger.log('noun poke', { app, mark });
    sent = captureSendContext(config.client);
    return config.client.pokeNoun({
      ...params,
      app,
      mark,
      noun,
    });
  };
  const fail = (err: any) => {
    logger.trackError(
      `NOUN POKE: bad poke to ${app} with mark ${mark}`,
      describeError(err)
    );
    throw err;
  };
  const retry = async (err: any) => {
    if (!config.client) {
      return fail(err);
    }
    if (isChannelIdentityMismatch(err)) {
      rotateChannelOnce(config.client, sent, `noun poke ${app}/${mark}`);
    } else if (err instanceof AuthError) {
      await reauthOnce(sent);
    } else {
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
  const doPoke = async () => {
    if (!activeClient) {
      throw new Error('Client not initialized');
    }
    if (activeClient === config.client && config.pendingAuth) {
      await config.pendingAuth;
    }
    sent = captureSendContext(activeClient);
    return activeClient.poke({ app, mark, json });
  };
  const fail = (err: any) => {
    logger.trackError(`bad poke to ${app} with mark ${mark}`, {
      ...describeError(err),
      body: json,
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
  if (config.pendingAuth) {
    await config.pendingAuth;
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
  if (config.pendingAuth) {
    await config.pendingAuth;
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

export async function checkIsNodeBusy() {
  return config.client?.checkIsNodeBusy() || Promise.resolve('unknown');
}

export async function checkIsNodeBusyWithHints(): Promise<{
  nodeBusyStatus: 'available' | 'busy' | 'unknown';
  hints?: string;
}> {
  if (!config.client) {
    throw new Error('Client not initialized');
  }

  const result = await client.getSpinHints();
  if (result === '/root') {
    return { nodeBusyStatus: 'available' };
  }

  return { nodeBusyStatus: 'busy', hints: result };
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
  if (activeClient === config.client && config.pendingAuth) {
    await config.pendingAuth;
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
        await activeClient.scryWithInfo<T>({ app, path });
      trackDuration('success', { responseSizeInBytes, responseStatus });
      return result;
    }
    trackDuration('error', {
      errorMessage: res.message,
      responseStatus: res.status,
    });
    throw new BadResponseError(res.status, res.toString());
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
  if (activeClient === config.client && config.pendingAuth) {
    await config.pendingAuth;
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

async function responseErrorBody(res: any): Promise<string> {
  if (typeof res?.text === 'function') {
    try {
      return await res.text();
    } catch {
      // Fall through to the generic cases below.
    }
  }
  if (typeof res?.body === 'string') return res.body;
  if (typeof res?.message === 'string') return res.message;
  const text = String(res);
  return text === '[object Response]' ? '' : text;
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
  if (!config.client) {
    throw new Error('Client not initialized');
  }
  if (config.pendingAuth) {
    await config.pendingAuth;
  }
  logger.log('scry noun', app, path);
  const trackDuration = createDurationTracker(AnalyticsEvent.ScryNoun, {
    app,
    path: redactPath(path),
    shouldTimeoutAfter: timeout ?? DEFAULT_SCRY_TIMEOUT,
  });
  try {
    const { result, responseSizeInBytes, responseStatus } =
      await config.client.scryNounWithInfo({
        app,
        path,
        timeout: timeout ?? DEFAULT_SCRY_TIMEOUT,
      });
    trackDuration('success', { responseSizeInBytes, responseStatus });
    return result;
  } catch (res) {
    logger.log('bad scry', app, path, res.status);
    if (res.status === 403) {
      logger.log('scry failed with 403, authing to try again');
      await reauth();
      const { result, responseSizeInBytes, responseStatus } =
        await config.client.scryNounWithInfo({ app, path });
      trackDuration('success', { responseSizeInBytes, responseStatus });
      return result;
    }
    trackDuration('error', {
      message: res.message,
      responseStatus: res.status,
    });
    throw new BadResponseError(res.status, res.toString());
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

async function reauth() {
  if (config.loggingOut) {
    return;
  }

  if (!config.getCode) {
    logger.log('No getCode function provided for auth');
    if (config.handleAuthFailure) {
      logger.log('calling auth failure handler');
      return config.handleAuthFailure({ mustLogout: false });
    }

    throw new Error('Unable to authenticate with urbit');
  }

  // Dedupe synchronously, before anything is awaited: every caller that shows
  // up while a reauth is in flight shares it. Concurrent logins are actively
  // harmful, since eyre closes the session a login request arrives with, so
  // parallel logins invalidate each other and all but one come back 401.
  if (!config.pendingAuth) {
    config.pendingAuth = performReauth().finally(() => {
      config.pendingAuth = null;
    });
  }
  return config.pendingAuth;
}

const MAX_LOGIN_ATTEMPTS = 4;

async function performReauth(): Promise<string | void> {
  let code: string;
  try {
    logger.log('getting urbit code');
    code = await config.getCode!();
  } catch (e) {
    logger.error('error getting urbit code', e);
    if (config.handleAuthFailure) {
      return config.handleAuthFailure({ mustLogout: false });
    }
    throw e;
  }

  for (let attempt = 0; ; attempt++) {
    const lastAttempt = attempt >= MAX_LOGIN_ATTEMPTS - 1;
    let authCookie: string | undefined;
    try {
      logger.log('trying to auth with code', code);
      authCookie = await getLandscapeAuthCookie(config.shipUrl, code);
    } catch (e) {
      if (e instanceof AuthFailureError && e.responseStatus === 400) {
        // the code itself was rejected; no retry will fix that, so log out
        config.loggingOut = true;
        config.handleAuthFailure?.({ mustLogout: true });
        return;
      }
      // a 401 means the request carried a session cookie the ship no longer
      // recognizes; the response expires it, so a retry can go through clean
      const staleCookie =
        e instanceof AuthFailureError && e.responseStatus === 401;
      if (!staleCookie || lastAttempt) {
        throw new Error(`Error during reauth: ${e}`);
      }
    }

    if (authCookie) {
      config.authEpoch += 1;
      if (config.client) {
        config.client.cookie = authCookie;
        // logging in moved us to a new session. any channel we opened under
        // the old one is either gone (eyre closed the old session's channels)
        // or bound to an identity that is no longer ours, so start fresh
        // before waiters retry against it
        if (config.client.channelOpened) {
          rotateChannel(config.client, 'reauth');
        }
      }
      return authCookie;
    }

    if (lastAttempt) {
      if (config.handleAuthFailure) {
        logger.log('auth failed, calling auth failure handler');
        config.handleAuthFailure({ mustLogout: false });
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
