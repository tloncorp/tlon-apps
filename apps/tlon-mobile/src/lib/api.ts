import { deSig } from '@urbit/aura';

import { createHexString } from '../utils/string';

const config = {
  shipName: '',
  shipUrl: '',
  channelUrl: '',
};

let lastEventId = 1;

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
