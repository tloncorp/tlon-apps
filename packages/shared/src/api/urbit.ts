import { preSig } from '@urbit/api';
import { deSig } from '@urbit/aura';
import { Urbit } from '@urbit/http-api';
import _ from 'lodash';

import { createDevLogger } from '../debug';

const logger = createDevLogger('urbit', true);

const config = {
  shipName: '',
  shipUrl: '',
};

type Predicate = (event: any, mark: string) => boolean;
interface Watcher {
  id: string;
  predicate: Predicate;
  resolve: (value: void | PromiseLike<void>) => void;
  reject: (reason?: any) => void;
}

type Watchers = Record<string, Map<string, Watcher>>;

let clientInstance: Urbit | null = null;
let subWatchers: Watchers = {};

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

export function configureClient({
  shipName,
  shipUrl,
  fetchFn,
  verbose,
  onReset,
  onChannelReset,
}: {
  shipName: string;
  shipUrl: string;
  fetchFn?: typeof fetch;
  verbose?: boolean;
  onReset?: () => void;
  onChannelReset?: () => void;
}) {
  logger.log('configuring client', shipName, shipUrl);
  clientInstance = new Urbit(shipUrl, undefined, undefined, fetchFn);
  clientInstance.ship = deSig(shipName);
  clientInstance.our = preSig(shipName);
  clientInstance.verbose = verbose;
  clientInstance.on('status-update', (status) => {
    logger.log('status-update', status);
  });

  clientInstance.onReconnect = () => {
    logger.log('client reconnect');
  };

  clientInstance.on('reset', () => {
    logger.log('client reset');
    Object.values(subWatchers).forEach((watchers) => {
      watchers.forEach((watcher) => watcher.reject('Client reset'));
    });
    subWatchers = {};
    onReset?.();
  });

  clientInstance.on('seamless-reset', () => {
    logger.log('client seamless-reset');
  });

  clientInstance.on('error', (error) => {
    logger.log('client error', error);
  });

  clientInstance.on('channel-reaped', () => {
    logger.log('client channel-reaped');
    onChannelReset?.();
  });

  subWatchers = {};
}

export function removeUrbitClient() {
  clientInstance = null;
}

interface UrbitEndpoint {
  app: string;
  path: string;
}

function printEndpoint(endpoint: UrbitEndpoint) {
  return `${endpoint.app}${endpoint.path}`;
}

export function subscribe<T>(
  endpoint: UrbitEndpoint,
  handler: (update: T) => void,
  resubscribing = false
) {
  if (!clientInstance) {
    throw new Error('Tried to subscribe, but Urbit client is not initialized');
  }

  logger.log(
    resubscribing ? 'resubscribing to' : 'subscribing to',
    printEndpoint(endpoint)
  );

  clientInstance.subscribe({
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
      const endpointWatchers = subWatchers[endpointKey];
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
      subscribe(endpoint, handler, true);
    },
    err: (error) => {
      logger.error(`subscribe error on ${printEndpoint(endpoint)}:`, error);
    },
  });
}

export const subscribeOnce = async <T>(
  endpoint: UrbitEndpoint,
  timeout?: number
) => {
  logger.log('subscribing once to', printEndpoint(endpoint));
  return client.subscribeOnce<T>(endpoint.app, endpoint.path, timeout);
};

export const configureApi = (shipName: string, shipUrl: string) => {
  config.shipName = deSig(shipName);
  config.shipUrl = shipUrl;
  logger.debug('Configured new Urbit API for', shipName);
};

export const poke = async ({
  app,
  mark,
  json,
}: {
  app: string;
  mark: string;
  json: any;
}) => {
  logger.log('poke', app, mark, json);
  return clientInstance?.poke({
    app,
    mark,
    json,
  });
};

export type PokeParams = {
  app: string;
  mark: string;
  json: any;
};

export const trackedPoke = async <T, R = T>(
  params: PokeParams,
  endpoint: UrbitEndpoint,
  predicate: (event: R) => boolean
) => {
  try {
    const tracking = track(endpoint, predicate);
    const poking = poke(params);
    await Promise.all([tracking, poking]);
  } catch (e) {
    logger.error(`tracked poke failed`, e);
    throw e;
  }
};

const track = async <R>(
  endpoint: UrbitEndpoint,
  predicate: (event: R) => boolean
) => {
  const endpointKey = printEndpoint(endpoint);
  return new Promise((resolve, reject) => {
    const watchers = subWatchers[endpointKey] || new Map();
    const id = _.uniqueId();

    subWatchers[endpointKey] = watchers.set(id, {
      id,
      predicate,
      resolve,
      reject,
    });
  });
};

export class BadResponseError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super();
  }
}

export const scry = async <T>({ app, path }: { app: string; path: string }) => {
  logger.log('scry', app, path);
  const res = await fetch(`${config.shipUrl}/~/scry/${app}${path}.json`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
  });
  if (!res.ok) {
    logger.log('bad scry', app, path, res.status);
    const body = await res.text();
    throw new BadResponseError(res.status, body);
  }
  return (await res.json()) as T;
};
