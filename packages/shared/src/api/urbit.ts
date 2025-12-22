import { Noun } from '@urbit/nockjs';
import _ from 'lodash';

import { createDevLogger, escapeLog, runIfDev } from '../debug';
import { AnalyticsEvent, getConstants } from '../domain';
import * as Hosting from '../domain/hosting';
import {
  AuthError,
  ChannelStatus,
  NounPokeInterface,
  PokeInterface,
  Thread,
  Urbit,
} from '../http-api';
import { preSig } from '../urbit';
import { getLandscapeAuthCookie } from './landscapeApi';

const logger = createDevLogger('urbit', false);

const DEFAULT_SCRY_TIMEOUT = 60 * 1000; // 1 minute
const DEFAULT_THREAD_TIMEOUT = 90 * 1000; // 90 seconds

interface Config
  extends Pick<
    ClientParams,
    'getCode' | 'handleAuthFailure' | 'shipUrl' | 'onQuitOrReset'
  > {
  client: Urbit | null;
  subWatchers: Watchers;
  pendingAuth: Promise<string | void> | null;
  lastStatus: string;
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
    super();
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
  handleAuthFailure?: () => void;
  onQuitOrReset?: (cause: 'subscriptionQuit' | 'reset') => void;
  onChannelStatusChange?: (status: ChannelStatus) => void;
}

const config: Config = {
  client: null,
  lastStatus: '',
  shipUrl: '',
  subWatchers: {},
  pendingAuth: null,
  onQuitOrReset: undefined,
  getCode: undefined,
  handleAuthFailure: undefined,
};

export const client = new Proxy(
  {},
  {
    get: function (target, prop, receiver) {
      if (!config.client) {
        throw new Error('Urbit client not set.');
      }
      return Reflect.get(config.client, prop, receiver);
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
}: ClientParams) {
  config.client = config.client || new Urbit(shipUrl, '', '', fetchFn);
  config.client.verbose = verbose;
  config.client.nodeId = preSig(shipName);
  config.shipUrl = shipUrl;
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

export function internalRemoveClient() {
  config.client?.delete();
  config.client = null;
  config.subWatchers = {};
}

function printEndpoint(endpoint: UrbitEndpoint) {
  return `${endpoint.app}${endpoint.path}`;
}

export async function subscribe<T>(
  endpoint: UrbitEndpoint,
  handler: (update: T, id?: number) => void
): Promise<number> {
  const doSub = async (err?: (error: any, id: string) => void) => {
    if (!config.client) {
      throw new Error('Client not initialized');
    }
    if (config.pendingAuth) {
      await config.pendingAuth;
    }
    logger.log('subscribing to', printEndpoint(endpoint));
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
        config.onQuitOrReset?.('subscriptionQuit');
      },
      err: (error, id) => {
        logger.trackError(`subscribe error on ${printEndpoint(endpoint)}`, {
          stack: error,
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
    if (!(err instanceof AuthError)) {
      throw err;
    }

    config.pendingAuth = reauth();
    return doSub();
  };

  try {
    return doSub(retry);
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
        stack: err,
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
  const doPoke = async (params?: Partial<NounPokeInterface>) => {
    if (!config.client) {
      throw new Error('Client not initialized');
    }
    if (config.pendingAuth) {
      await config.pendingAuth;
    }
    logger.log('noun poke', { app, mark });
    return config.client.pokeNoun({
      ...params,
      app,
      mark,
      noun,
    });
  };
  const retry = async (err: any) => {
    logger.trackError(`NOUN POKE: bad poke to ${app} with mark ${mark}`, {
      stack: err,
      noun: noun,
    });
    if (!(err instanceof AuthError)) {
      throw err;
    }

    await reauth();
    return doPoke();
  };

  try {
    return doPoke({ onError: retry });
  } catch (err) {
    retry(err);
  }
}

export async function poke({ app, mark, json }: PokeParams) {
  logger.log('poke', app, mark, json);
  const trackDuration = createDurationTracker(AnalyticsEvent.Poke, {
    app,
    mark,
  });
  const doPoke = async (params?: Partial<PokeInterface<any>>) => {
    if (!config.client) {
      throw new Error('Client not initialized');
    }
    if (config.pendingAuth) {
      await config.pendingAuth;
    }
    return config.client.poke({
      ...params,
      app,
      mark,
      json,
    });
  };
  const retry = async (err: any) => {
    logger.trackError(`bad poke to ${app} with mark ${mark}`, {
      stack: err,
      body: json,
    });
    if (!(err instanceof AuthError)) {
      trackDuration('error');
      throw err;
    }

    await reauth();
    return doPoke();
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

export async function scry<T>({
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
  logger.log('scry', app, path);
  const trackDuration = createDurationTracker(AnalyticsEvent.Scry, {
    app,
    path: redactPath(path),
    shouldTimeoutAfter: timeout ?? DEFAULT_SCRY_TIMEOUT,
  });
  try {
    const { result, responseSizeInBytes, responseStatus } =
      await config.client.scryWithInfo<T>({
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
        await config.client.scryWithInfo<T>({ app, path });
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
  if (!config.getCode) {
    logger.log('No getCode function provided for auth');
    if (config.handleAuthFailure) {
      logger.log('calling auth failure handler');
      return config.handleAuthFailure();
    }

    throw new Error('Unable to authenticate with urbit');
  }

  if (config.pendingAuth) {
    return config.pendingAuth;
  }

  try {
    let tries = 0;
    logger.log('getting urbit code');
    const code = await config.getCode();
    config.pendingAuth = new Promise<string>((resolve, reject) => {
      const tryAuth = async () => {
        try {
          logger.log('trying to auth with code', code);
          const authCookie = await getLandscapeAuthCookie(config.shipUrl, code);

          if (!authCookie && tries < 3) {
            logger.log('auth failed, trying again', tries);
            tries++;
            setTimeout(tryAuth, 1000 + 2 ** tries * 1000);
            return;
          }

          if (!authCookie) {
            config.pendingAuth = null;
            if (config.handleAuthFailure) {
              logger.log('auth failed, calling auth failure handler');
              config.handleAuthFailure();
            }

            reject(new Error("Couldn't authenticate with urbit"));
            return;
          }

          config.pendingAuth = null;
          resolve(authCookie);
          return;
        } catch (e) {
          reject(new Error(`Error during reauth: ${e}`));
        }
      };

      tryAuth();
    });

    return await config.pendingAuth;
  } catch (e) {
    logger.error('error getting urbit code', e);
    config.pendingAuth = null;
    if (config.handleAuthFailure) {
      return config.handleAuthFailure();
    }

    throw e;
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
