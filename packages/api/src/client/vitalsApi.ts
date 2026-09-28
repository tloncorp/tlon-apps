import { createDevLogger } from '../lib/logger';
import * as ub from '../urbit';
import { base, pokeRequest, scryRequest, subscribeRequest } from './requests';
import { unsubscribe } from './urbit';

const logger = createDevLogger('vitalsApi', false);

export const getLastConnectionStatus = async (contactId: string) => {
  const result = await scryRequest(base.vitalsShip)<ub.ConnectionUpdate>({
    ship: contactId,
  });
  return toConnectionStatus(result);
};

export const checkConnectionStatus = async (
  contactId: string,
  callback: (data: ConnectionStatus) => boolean
) => {
  let unsubscribed = false;
  const subscription = await subscribeRequest(
    base.vitalsStatus
  )<ub.ConnectionUpdate>({ ship: contactId }, (e, id) => {
    if (unsubscribed) {
      return;
    }

    const shouldUnsubscribe = callback(toConnectionStatus(e));

    if (shouldUnsubscribe && id) {
      unsubscribed = true;
      unsubscribe(id).catch((e) => logger.log('vitals unsubscribe failed', e));
    }
  });

  pokeRequest(base.vitalsRunCheck)(contactId).catch((e) =>
    logger.log('vitals poke failed', e)
  );

  return subscription;
};

export type ConnectionState =
  | 'yes'
  | 'crash'
  | 'no-data'
  | 'no-dns'
  | 'no-our-planet'
  | 'no-our-galaxy'
  | 'no-sponsor-hit'
  | 'no-sponsor-miss'
  | 'no-their-galaxy'
  | 'setting-up'
  | 'trying-dns'
  | 'trying-local'
  | 'trying-target'
  | 'trying-sponsor';

export type ConnectionStatus = {
  status: ConnectionState;
  complete: boolean;
  timestamp?: number;
};

export const toConnectionStatus = (
  data: ub.ConnectionUpdate
): ConnectionStatus => {
  if ('complete' in data.status) {
    return {
      complete: true,
      status: data.status.complete,
      timestamp: data.timestamp,
    };
  } else {
    return { complete: false, status: data.status.pending };
  }
};
