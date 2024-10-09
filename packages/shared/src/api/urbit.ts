import { deSig, preSig } from '@urbit/aura';
import { ChannelStatus, Urbit } from '@urbit/http-api';
import _ from 'lodash';

import { createDevLogger, escapeLog, runIfDev } from '../debug';

const logger = createDevLogger('urbit', false);

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
let handleChannelReset: (() => void) | undefined;
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
  onReconnect,
  onChannelReset,
  onChannelStatusChange,
}: {
  shipName: string;
  shipUrl: string;
  fetchFn?: typeof fetch;
  verbose?: boolean;
  onReconnect?: () => void;
  onChannelReset?: () => void;
  onChannelStatusChange?: (status: ChannelStatus) => void;
}) {
  logger.log('configuring client', shipName, shipUrl);
  clientInstance = new Urbit(shipUrl, undefined, undefined, fetchFn);
  clientInstance.ship = deSig(shipName);
  clientInstance.our = preSig(shipName);
  clientInstance.verbose = verbose;
  handleChannelReset = onChannelReset;
  subWatchers = {};

  clientInstance.onReconnect = () => {
    logger.log('client reconnected');
    onChannelStatusChange?.('reconnected');
    onReconnect?.();
  };

  clientInstance.onRetry = () => {
    logger.log('client retrying');
    onChannelStatusChange?.('reconnecting');
  };

  // the below event handlers will only fire if verbose is set to true
  clientInstance.on('status-update', (event) => {
    logger.log('status-update', event);
  });

  clientInstance.on('fact', (fact) => {
    logger.log(
      'received message',
      runIfDev(() => escapeLog(JSON.stringify(fact)))
    );
  });

  clientInstance.on('seamless-reset', () => {
    logger.log('client seamless-reset');
  });

  clientInstance.on('error', (error) => {
    logger.log('client error', error);
  });

  clientInstance.on('channel-reaped', () => {
    logger.log('client channel-reaped');
  });
}

export async function removeUrbitClient() {
  clientInstance?.reset();
  await clientInstance?.delete();
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
  handler: (update: T) => void
) {
  if (!clientInstance) {
    throw new Error('Tried to subscribe, but Urbit client is not initialized');
  }

  logger.log('subscribing to', printEndpoint(endpoint));

  return clientInstance.subscribe({
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
      handleChannelReset?.();
    },
    err: (error) => {
      logger.error(`subscribe error on ${printEndpoint(endpoint)}:`, error);
    },
  });
}

export const unsubscribe = (subcriptionId: number) => {
  if (!clientInstance) {
    throw new Error(
      'Tried to unsubscribe, but Urbit client is not initialized'
    );
  }
  clientInstance.unsubscribe(subcriptionId);
};

export const subscribeOnce = async <T>(
  endpoint: UrbitEndpoint,
  timeout?: number
) => {
  if (!clientInstance) {
    throw new Error(
      'Tried to subscribe once, but Urbit client is not initialized'
    );
  }
  logger.log('subscribing once to', printEndpoint(endpoint));
  return clientInstance.subscribeOnce<T>(endpoint.app, endpoint.path, timeout);
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
