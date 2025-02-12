import { Cell, Noun, dwim, enjs } from '@urbit/nockjs';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { getFrondValue, getPatp } from '../logic';
import { stringToTa } from '../urbit';
import { pokeNoun, scryNoun, subscribe } from './urbit';

const logger = createDevLogger('lanyardApi', true);

export type LanyardUpdate = { type: 'Default' };
export function subscribeToLanyardUpdates(
  eventHandler: (event: LanyardUpdate) => void
) {
  subscribe({ app: 'lanyard', path: '/records' }, (event) => {
    logger.log('raw lanyard sub event', event);
    eventHandler({ type: 'Default' });
  });
}

function getRecords(noun: Noun): db.Verification[] {
  return enjs.tree((n: Noun) => {
    if (!(n instanceof Cell)) {
      throw new Error('malformed map');
    }

    if (!(n.head instanceof Cell)) {
      throw new Error('malformed record key');
    }

    const provider = getPatp(n.head.head) as string;

    if (!(n.head.tail instanceof Cell)) {
      throw new Error('malformed record key identifier');
    }

    const type = enjs.cord(n.head.tail.head);
    const value = getFrondValue([
      { tag: 'dummy', get: enjs.cord },
      { tag: 'phone', get: enjs.cord },
      { tag: 'urbit', get: getPatp },
      { tag: 'twitter', get: enjs.cord },
    ])(n.head.tail) as string;

    if (!(n.tail instanceof Cell)) {
      throw new Error('malformed record value');
    }

    const config = enjs.cord(n.tail.head) as db.VerificationVisibility;
    const status = getFrondValue([
      { tag: 'want', get: () => 'pending' },
      { tag: 'wait', get: () => 'waiting' },
      { tag: 'done', get: () => 'verified' },
    ])(n.tail.tail) as db.VerificationStatus;

    return {
      provider,
      type,
      value,
      initiatedAt: null,
      visibility: config,
      status,
    };
  })(noun) as unknown as db.Verification[];
}

function getProof(noun: Noun) {
  if (!(noun instanceof Cell)) {
    console.log('no good!', noun);
    throw new Error('malformed proof bundle, not a cell');
  }

  const head = noun.head;
  const tail = noun.tail;

  const payload = enjs.cord(head);
  const url = enjs.cord(tail);

  return { payload, url };
}

export async function fetchTwitterConfirmPayload(handle: string) {
  const result = await scryNoun({
    app: 'lanyard',
    path: `/v1/proof/twitter/bundle/${stringToTa(handle)}`,
  });

  const parsed = getProof(result);
  console.log(`bl: we parsed the thing`, parsed);
  return parsed;
}

export async function fetchVerifications(): Promise<db.Verification[]> {
  const result = await scryNoun({
    app: 'lanyard',
    path: '/v1/records',
  });
  console.log(`bl: scry result`, result);
  const records = getRecords(result);
  console.log(`bl: records`, records);

  return records;
}

export async function initiatePhoneVerify(phoneNumber: string) {
  const payload = [null, ['start', ['phone', phoneNumber]]];
  const noun = dwim(payload);
  await pokeNoun({ app: 'lanyard', mark: 'lanyard-command', noun });
  return;
}

export function confirmPhoneVerify(phoneNumber: string, otp: string) {
  // TODO
}

export async function initiateTwitterAttestation(twitterHandle: string) {
  const payload = [null, ['start', ['twitter', twitterHandle]]];
  logger.log('initiateTwitterAttestation', payload);
  const noun = dwim(payload);
  await pokeNoun({ app: 'lanyard', mark: 'lanyard-command', noun });
  logger.log('initiateTwitterAttestation poke success');
  return;
}

export async function confirmTwitterAttestation(
  twitterHandle: string,
  postId: string
) {
  const identifier = ['twitter', twitterHandle];
  const proof = ['twitter', 'post', postId];
  const payload = [null, ['work', identifier, proof]];
  logger.log('confirmTwitterAttestation', payload);
  const noun = dwim(payload);
  await pokeNoun({ app: 'lanyard', mark: 'lanyard-command', noun });
  logger.log('confirmTwitterAttestation poke success');
  return;
}
