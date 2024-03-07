import { deSig } from '@urbit/aura';
import Urbit from '@urbit/http-api';

import { createHexString } from '../utils/string';

const config = {
  shipName: '',
  shipUrl: '',
  channelUrl: '',
};

let lastEventId = 1;
let client: Urbit;

function fetchHandler(url: URL | RequestInfo, init?: RequestInit | undefined): Promise<Response> {
  return fetch(url, { ...(init ?? {}), reactNative: { textStreaming: true}} as RequestInit);
}

export const initClient = (shipUrl: string) => {
  client = new Urbit(shipUrl, undefined, undefined, fetchHandler);
  client.verbose = true;

  console.log('initialized client', client);

  client.subscribe({
    app: 'channels',
    path: '/',
    event: (json: any) => {
      console.log('got a sub event', json);
    }
  });
};

// export function useSubUnreads () {
//   client.subscribe({
//     app: ''
//   })
// }

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
