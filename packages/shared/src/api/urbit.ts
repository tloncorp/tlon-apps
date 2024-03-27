import { deSig } from '@urbit/aura';
import { Urbit } from '@urbit/http-api';

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
}: {
  shipName: string;
  shipUrl: string;
  fetchFn?: typeof fetch;
}) {
  clientInstance = new Urbit(shipUrl, undefined, undefined, fetchFn);
  clientInstance.ship = deSig(shipName);
  clientInstance.verbose = true;

  clientInstance.on('status-update', (status) => {
    console.log(`client status:`, status);
  });

  clientInstance.on('error', (error) => {
    console.error('client error:', error);
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

// TODO: we need to harden this similar to tlon-web
export function subscribe<T>(
  endpoint: UrbitEndpoint,
  handler: (update: T) => void
) {
  if (!clientInstance) {
    throw new Error('Tied to subscribe, but Urbit client is not initialized');
  }

  clientInstance.subscribe({
    app: endpoint.app,
    path: endpoint.path,
    event: (data: T) => {
      console.debug(
        `got subscription event on ${printEndpoint(endpoint)}:`,
        data
      );
      handler(data);
    },
    err: (error) => {
      console.error(`subscribe error on ${printEndpoint(endpoint)}:`, error);
    },
  });
}

export const configureApi = (shipName: string, shipUrl: string) => {
  config.shipName = deSig(shipName);
  config.shipUrl = shipUrl;
  console.debug('Configured new Urbit API for', shipName);
};

export const poke = async ({
  app,
  mark,
  json,
}: {
  app: string;
  mark: string;
  json: any;
}) =>
  clientInstance?.poke({
    app,
    mark,
    json,
  });

export const scry = async <T>({ app, path }: { app: string; path: string }) => {
  console.log('Scry', `${config.shipUrl}/~/scry/${app}${path}.json`);
  return fetch(`${config.shipUrl}/~/scry/${app}${path}.json`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
  }).then((res) => res.json()) as Promise<T>;
};
