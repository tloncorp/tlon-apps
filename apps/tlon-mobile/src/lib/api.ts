import { deSig } from '@urbit/aura';
import { Urbit } from '@urbit/http-api';

import { createHexString } from '../utils/string';

const config = {
  shipName: '',
  shipUrl: '',
  channelUrl: '',
};

let lastEventId = 1;
let client: Urbit | null = null;

export function initializeUrbitClient(shipName: string, shipUrl: string) {
  client = new Urbit(
    shipUrl,
    undefined,
    undefined,
    (input, { ...init } = {}) => {
      const headers = new Headers(init.headers);
      // The urbit client is inconsistent about sending cookies, sometimes causing
      // the server to send back a new, anonymous, cookie, which is sent on all
      // subsequent requests and screws everything up. This ensures that explicit
      // cookie headers are never set, delegating all cookie handling to the
      // native http client.
      headers.delete('Cookie');
      headers.delete('cookie');
      const newInit: RequestInit = {
        ...init,
        headers,
        // Avoid setting credentials method for same reason as above.
        credentials: undefined,
        // @ts-expect-error This is used by the SSE polyfill to determine whether
        // to stream the request.
        reactNative: { textStreaming: true },
      };
      return fetch(input, newInit);
    }
  );
  client.ship = deSig(shipName);
  client.verbose = true;

  client.on('status-update', (status) => {
    console.log(`client status:`, status);
  });

  client.on('error', (error) => {
    console.error('client error:', error);
  });
}

export function removeUrbitClient() {
  client = null;
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
  if (!client) {
    throw new Error('Tied to subscribe, but Urbit client is not initialized');
  }

  client.subscribe({
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
  config.channelUrl = `${shipUrl}/~/channel/${Math.floor(
    Date.now() / 1000
  )}-${createHexString(6)}`;
  console.debug('Configured new Urbit API for', shipName);
};

const putJson = async (json: any) => {
  const response = await fetch(config.channelUrl, {
    method: 'PUT',
    body: JSON.stringify([
      {
        ...json,
        id: lastEventId,
        ship: config.shipName,
      },
    ]),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  lastEventId += 1;
  return response;
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
  putJson({
    action: 'poke',
    app,
    mark,
    json,
  });

export const scry = async <T>({ app, path }: { app: string; path: string }) => {
  return fetch(`${config.shipUrl}/~/scry/${app}${path}.json`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
  }).then((res) => res.json()) as Promise<T>;
};
