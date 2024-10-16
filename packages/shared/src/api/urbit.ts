import { deSig, preSig } from '@urbit/aura';
import _ from 'lodash';

import { createDevLogger, escapeLog, runIfDev } from '../debug';
import { AuthError, ChannelStatus, PokeInterface, Urbit } from '../http-api';
import { getLandscapeAuthCookie } from './landscapeApi';

const logger = createDevLogger('urbit', false);

interface Config
  extends Pick<
    ClientParams,
    'getCode' | 'handleAuthFailure' | 'shipUrl' | 'onQuitOrReset'
  > {
  client: Urbit | null;
  subWatchers: Watchers;
  pendingAuth: Promise<string | void> | null;
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

export class BadResponseError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super();
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
  getCode?: () => Promise<string>;
  handleAuthFailure?: () => void;
  onQuitOrReset?: () => void;
  onChannelStatusChange?: (status: ChannelStatus) => void;
}

const config: Config = {
  client: null,
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
        throw new Error('Database not set.');
      }
      return Reflect.get(config.client, prop, receiver);
    },
  }
) as Urbit;

export const getCurrentUserId = () => {
  if (!client.our) {
    throw new Error('Client not initialized');
  }
  return client.our;
};

export const getCurrentUserIsHosted = () => {
  if (!client.our) {
    throw new Error('Client not initialized');
  }

  return client.url.endsWith('tlon.network');
};

export function internalConfigureClient({
  shipName,
  shipUrl,
  verbose,
  getCode,
  handleAuthFailure,
  onQuitOrReset,
  onChannelStatusChange,
}: ClientParams) {
  logger.log('configuring client', shipName, shipUrl);
  config.client = config.client || new Urbit(shipUrl, '', '');
  config.client.ship = deSig(shipName);
  config.client.our = preSig(shipName);
  config.client.verbose = verbose;
  config.shipUrl = shipUrl;
  config.onQuitOrReset = onQuitOrReset;
  config.getCode = getCode;
  config.handleAuthFailure = handleAuthFailure;
  config.subWatchers = {};

  // the below event handlers will only fire if verbose is set to true
  config.client.on('status-update', (event) => {
    logger.log('status-update', event);
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
    config.onQuitOrReset?.();
  });

  config.client.on('error', (error) => {
    logger.log('client error', error);
  });

  config.client.on('channel-reaped', () => {
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
  handler: (update: T) => void
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
        handler(event);
      },
      quit: () => {
        logger.log('subscription quit on', printEndpoint(endpoint));
        config.onQuitOrReset?.();
      },
      err: (error, id) => {
        logger.error(`subscribe error on ${printEndpoint(endpoint)}:`, error);

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
  timeout?: number
) {
  if (!config.client) {
    throw new Error('Client not initialized');
  }
  if (config.pendingAuth) {
    await config.pendingAuth;
  }
  logger.log('subscribing once to', printEndpoint(endpoint));
  try {
    return config.client.subscribeOnce<T>(endpoint.app, endpoint.path, timeout);
  } catch (err) {
    logger.error('bad subscribeOnce', printEndpoint(endpoint), err);
    if (!(err instanceof AuthError)) {
      throw err;
    }

    await reauth();
    return config.client.subscribeOnce<T>(endpoint.app, endpoint.path, timeout);
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

export async function poke({ app, mark, json }: PokeParams) {
  logger.log('poke', app, mark, json);
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
    logger.log('bad poke', app, mark, json, err);
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

export async function trackedPoke<T, R = T>(
  params: PokeParams,
  endpoint: UrbitEndpoint,
  predicate: (event: R) => boolean
) {
  if (config.pendingAuth) {
    await config.pendingAuth;
  }
  try {
    const tracking = track(endpoint, predicate);
    const poking = poke(params);
    await Promise.all([tracking, poking]);
  } catch (e) {
    logger.error(`tracked poke failed`, e);
    throw e;
  }
}

async function track<R>(
  endpoint: UrbitEndpoint,
  predicate: (event: R) => boolean
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
  });
}

export async function scry<T>({ app, path }: { app: string; path: string }) {
  if (!config.client) {
    throw new Error('Client not initialized');
  }
  if (config.pendingAuth) {
    await config.pendingAuth;
  }
  logger.log('scry', app, path);
  try {
    return await config.client.scry<T>({ app, path });
  } catch (res) {
    logger.log('bad scry', app, path, res.status);
    if (res.status === 403) {
      logger.log('scry failed with 403, authing to try again');
      await reauth();
      return config.client.scry<T>({ app, path });
    }
    const body = await res.text();
    throw new BadResponseError(res.status, body);
  }
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
        logger.log('trying to auth with code', code);
        const authCookie = await getLandscapeAuthCookie(config.shipUrl, code);

        if (!authCookie && tries < 3) {
          logger.log('auth failed, trying again', tries);
          tries++;
          setTimeout(tryAuth, 1000 + 2 ** tries * 1000);
          return;
        }

        if (!authCookie) {
          if (config.handleAuthFailure) {
            logger.log('auth failed, calling auth failure handler');
            config.pendingAuth = null;
            return config.handleAuthFailure();
          }

          config.pendingAuth = null;
          reject(new Error("Couldn't authenticate with urbit"));
          return;
        }

        config.pendingAuth = null;
        resolve(authCookie);
        return;
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
