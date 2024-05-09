import { deSig } from '@urbit/aura';
import { Urbit } from '@urbit/http-api';

import { createDevLogger } from '../debug';

const logger = createDevLogger('urbit', false);

const config = {
  shipName: '',
  shipUrl: '',
};

let clientInstance: Urbit | null = null;

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

export function configureClient({
  shipName,
  shipUrl,
  fetchFn,
  verbose,
  onReset,
}: {
  shipName: string;
  shipUrl: string;
  fetchFn?: typeof fetch;
  verbose?: boolean;
  onReset?: () => void;
}) {
  logger.log('configuring client', shipName, shipUrl);
  clientInstance = new Urbit(shipUrl, undefined, undefined, fetchFn);
  clientInstance.ship = deSig(shipName);
  clientInstance.verbose = verbose;
  clientInstance.on('status-update', (status) => {
    logger.log('status-update', status);
  });

  clientInstance.onReconnect = () => {
    logger.log('client reconnect');
  };

  clientInstance.on('reset', () => {
    logger.log('client reset');
    onReset?.();
  });

  clientInstance.on('seamless-reset', () => {
    logger.log('client seamless-reset');
  });

  clientInstance.on('error', (error) => {
    logger.log('client error', error);
  });
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
    event: (data: T) => {
      logger.debug(
        `got subscription event on ${printEndpoint(endpoint)}:`,
        data
      );
      handler(data);
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
