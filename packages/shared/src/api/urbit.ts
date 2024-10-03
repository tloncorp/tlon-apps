import { deSig, preSig } from '@urbit/aura';
import {
  ChannelStatus,
  PokeInterface,
  SubscriptionRequestInterface,
  Urbit,
} from '@urbit/http-api';
import _ from 'lodash';

import { createDevLogger, escapeLog, runIfDev } from '../debug';
import { getLandscapeAuthCookie } from './landscapeApi';

const logger = createDevLogger('urbit', false);

const config = {
  shipName: '',
  shipUrl: '',
};

let clientInstance: Client | null = null;

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
  fetchFn?: typeof fetch;
  getCode?: () => Promise<string>;
  handleAuthFailure?: () => void;
  onReset?: () => void;
  onChannelReset?: () => void;
  onChannelStatusChange?: (status: ChannelStatus) => void;
}

export const client = new Proxy(
  {},
  {
    get: function (target, prop, receiver) {
      if (!clientInstance) {
        throw new Error('Database not set.');
      }
      return Reflect.get(clientInstance, prop, receiver);
    },
  }
) as Client;

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

export function configureClient(params: ClientParams) {
  logger.log('configuring client', params);
  clientInstance = new Client(params);
}

export function removeUrbitClient() {
  clientInstance = null;
}

function printEndpoint(endpoint: UrbitEndpoint) {
  return `${endpoint.app}${endpoint.path}`;
}

export const configureApi = (shipName: string, shipUrl: string) => {
  config.shipName = deSig(shipName);
  config.shipUrl = shipUrl;
  logger.log('Configured new Urbit API for', shipName);
};

export class Client {
  private client: Urbit;

  shipName: string;
  shipUrl: string;
  subWatchers: Watchers = {};
  getCode?: () => Promise<string>;
  handleAuthFailure?: () => void;
  onReset?: () => void;
  onChannelReset?: () => void;
  onChannelStatusChange?: (status: ChannelStatus) => void;

  get ship() {
    return this.client.ship;
  }
  get our() {
    return this.client.our;
  }
  get url() {
    return this.shipUrl;
  }

  constructor(params: ClientParams) {
    this.shipName = params.shipName;
    this.shipUrl = params.shipUrl;
    logger.log('configuring client', this.shipName, this.shipUrl);
    this.client = new Urbit(this.shipUrl, '', '', params.fetchFn);
    this.client.ship = deSig(this.shipName);
    this.client.our = preSig(this.shipName);
    this.client.verbose = params.verbose;
    this.getCode = params.getCode;
    this.handleAuthFailure = params.handleAuthFailure;
    this.onReset = params.onReset;
    this.onChannelReset = params.onChannelReset;
    this.onChannelStatusChange = params.onChannelStatusChange;

    this.client.on('status-update', (event) => {
      logger.log('status-update', event);
      this.onChannelStatusChange?.(event.status);
    });

    this.client.on('fact', (fact) => {
      logger.log(
        'received message',
        runIfDev(() => escapeLog(JSON.stringify(fact)))
      );
    });

    this.client.onReconnect = () => {
      logger.log('client reconnect');
    };

    this.client.on('reset', () => {
      logger.log('client reset');
      Object.values(this.subWatchers).forEach((watchers) => {
        watchers.forEach((watcher) => watcher.reject('Client reset'));
      });
      this.subWatchers = {};
      this.onReset?.();
    });

    this.client.on('seamless-reset', () => {
      logger.log('client seamless-reset');
    });

    this.client.on('error', (error) => {
      logger.log('client error', error);
    });

    this.client.on('channel-reaped', () => {
      logger.log('client channel-reaped');
      this.onChannelReset?.();
    });
  }

  async subscribe<T>(
    endpoint: UrbitEndpoint,
    handler: (update: T) => void,
    resubscribing = false
  ) {
    const doSub = (err?: (error: any, id: string) => void) => {
      logger.log(
        resubscribing ? 'resubscribing to' : 'subscribing to',
        printEndpoint(endpoint)
      );
      return this.client.subscribe({
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
          const endpointWatchers = this.subWatchers[endpointKey];
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
          this.subscribe(endpoint, handler, true);
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
      await this.auth();
      return doSub();
    };

    try {
      return doSub(retry);
    } catch (err) {
      return retry(err);
    }
  }

  async subscribeOnce<T>(endpoint: UrbitEndpoint, timeout?: number) {
    logger.log('subscribing once to', printEndpoint(endpoint));
    try {
      return this.client.subscribeOnce<T>(endpoint.app, endpoint.path, timeout);
    } catch (err) {
      logger.error('bad subscribeOnce', printEndpoint(endpoint), err);
      await this.auth();
      return this.client.subscribeOnce<T>(endpoint.app, endpoint.path, timeout);
    }
  }

  async unsubscribe(id: number) {
    try {
      return this.client.unsubscribe(id);
    } catch (err) {
      logger.error('bad unsubscribe', id, err);
      await this.auth();
      return this.client.unsubscribe(id);
    }
  }

  async poke({ app, mark, json }: PokeParams) {
    logger.log('poke', app, mark, json);
    const doPoke = (params?: Partial<PokeInterface<any>>) =>
      this.client.poke({
        ...params,
        app,
        mark,
        json,
      });
    const retry = async (err: any) => {
      logger.log('bad poke', app, mark, json, err);
      await this.auth();
      return doPoke();
    };

    try {
      return doPoke({ onError: retry });
    } catch (err) {
      retry(err);
    }
  }

  async trackedPoke<T, R = T>(
    params: PokeParams,
    endpoint: UrbitEndpoint,
    predicate: (event: R) => boolean
  ) {
    try {
      const tracking = this.track(endpoint, predicate);
      const poking = this.poke(params);
      await Promise.all([tracking, poking]);
    } catch (e) {
      logger.error(`tracked poke failed`, e);
      throw e;
    }
  }

  private async track<R>(
    endpoint: UrbitEndpoint,
    predicate: (event: R) => boolean
  ) {
    const endpointKey = printEndpoint(endpoint);
    return new Promise((resolve, reject) => {
      const watchers = this.subWatchers[endpointKey] || new Map();
      const id = _.uniqueId();

      this.subWatchers[endpointKey] = watchers.set(id, {
        id,
        predicate,
        resolve,
        reject,
      });
    });
  }

  async scry<T>({ app, path }: { app: string; path: string }) {
    logger.log('scry', app, path);
    try {
      return this.client.scry<T>({ app, path });
    } catch (res) {
      logger.log('bad scry', app, path, res.status);
      if (res.status === 403) {
        logger.log('scry failed with 403, authing to try again');
        await this.auth();
        return this.client.scry<T>({ app, path });
      }
      const body = await res.text();
      throw new BadResponseError(res.status, body);
    }
  }

  private async auth() {
    if (!this.getCode) {
      console.warn('No getCode function provided for auth');
      if (this.handleAuthFailure) {
        return this.handleAuthFailure();
      }

      throw new Error('Unable to authenticate with urbit');
    }

    try {
      let tries = 0;
      logger.log('getting urbit code');
      const code = await this.getCode();
      return new Promise<string>((resolve, reject) => {
        const tryAuth = async () => {
          logger.log('trying to auth with code', code);
          const authCookie = await getLandscapeAuthCookie(this.shipUrl, code);

          if (!authCookie && tries < 3) {
            logger.log('auth failed, trying again', tries);
            tries++;
            setTimeout(tryAuth, 1000 + 2 ** tries * 1000);
            return;
          }

          if (!authCookie) {
            if (this.handleAuthFailure) {
              logger.log('auth failed, calling auth failure handler');
              return this.handleAuthFailure();
            }

            reject(new Error("Couldn't authenticate with urbit"));
            return;
          }

          resolve(authCookie);
          return;
        };

        tryAuth();
      });
    } catch (e) {
      logger.error('error getting urbit code', e);
      if (this.handleAuthFailure) {
        return this.handleAuthFailure();
      }

      throw e;
    }
  }
}
