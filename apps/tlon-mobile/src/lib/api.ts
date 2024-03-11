import { deSig } from '@urbit/aura';

import { createHexString } from '../utils/string';
import { Urbit } from './urbit/src';

const config = {
  shipName: '',
  shipUrl: '',
  channelUrl: '',
};

let lastEventId = 1;
let client: Urbit;

export function initializeUrbit(ship: string, shipUrl: string) {
  client = new Urbit(shipUrl, undefined, undefined);
  client.ship = 'pondus-watbel';
  client.verbose = true;
}

export function useUnreads() {
  client.on('status-update', (status) => {
    console.log(`client status:`, status);
  });

  client.on('error', (error) => {
    console.error('client error:', error);
  });

  client.subscribe({
    app: 'chat',
    path: '/unreads',
    event: (json) => {
      console.log(`got sub event:`, json);
    },
    err: (error) => {
      console.error(`got sub error:`, error);
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
