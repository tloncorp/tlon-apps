import { deSig } from '@urbit/aura';
import { Urbit } from '@urbit/http-api';

import { createHexString } from '../utils/string';

const config = {
  shipName: '',
  shipUrl: '',
  channelUrl: '',
};

let lastEventId = 1;
export let client: Urbit;

// TODO: remove client on logout
export function initializeUrbitClient(shipName: string, shipUrl: string) {
  client = new Urbit(shipUrl, undefined, undefined);
  client.ship = deSig(shipName);
  client.verbose = true;

  client.on('status-update', (status) => {
    console.log(`client status:`, status);
  });

  client.on('error', (error) => {
    console.error('client error:', error);
  });
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
