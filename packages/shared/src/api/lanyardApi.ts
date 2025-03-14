import { daToUnix, parseUw } from '@urbit/aura';
import { Atom, Cell, Noun, cue, dwim, enjs } from '@urbit/nockjs';

import * as db from '../db';
import { VerificationType } from '../db/schema';
import { createDevLogger } from '../debug';
import { getFrondValue, getPatp, simpleHash } from '../logic';
import { stringToTa } from '../urbit';
import * as NounParsers from './nounParsers';
import {
  getCurrentUserId,
  pokeNoun,
  scryNoun,
  subscribe,
  trackedPokeNoun,
} from './urbit';

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

interface HalfSign {
  signType: 'half';
  when: number;
  kind: string;
}

interface FullSign {
  signType: 'full';
  when: number;
  kind: string;

  provider: string;
  value: string;
  type: VerificationType;
}

type Sign = HalfSign | FullSign;

// send to /valid-jam/${sign} -> noun (bool, good/no good)

export async function checkAttestedSignature(signData: string) {
  console.log(`bl: checking sig`);
  const query = [null, null, ['valid-jam', signData]];
  const noun = dwim(query);
  await trackedPokeNoun(
    { app: 'lanyard', mark: 'lanyard-query', noun },
    { app: 'lanyard', path: '/query' },
    (event) => {
      console.log(`bl: got valid jam sub event`, event);
      return false;
    }
  );
}

function nounToClientRecords(noun: Noun, contactId: string): db.Verification[] {
  console.log(`noun to client records`);
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

    const type = enjs.cord(n.head.tail.head) as db.VerificationType;
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
    const currentUserId = getCurrentUserId();
    console.log(`check: 1`);
    const { status, sign } = getFrondValue<{
      status: db.VerificationStatus;
      sign: NounParsers.Sign | null;
    }>([
      { tag: 'want', get: () => ({ status: 'pending', sign: null }) },
      { tag: 'wait', get: () => ({ status: 'waiting', sign: null }) },
      {
        tag: 'done',
        get: (noun: Noun) => ({
          status: 'verified',
          sign: NounParsers.parseAttestation(noun, currentUserId),
        }),
      },
    ])(n.tail.tail);
    console.log(`check: 2`, { status, sign });

    const id = parseAttestationId({ provider, type, value, contactId });
    const provingTweetId =
      sign?.signType === 'full' ? sign.proofTweetId ?? null : null;

    const verif: db.Verification = {
      id,
      contactId,
      provider,
      type,
      value,
      initiatedAt: null,
      visibility: config,
      status,
      provingTweetId,
    };

    return verif;
  })(noun) as unknown as db.Verification[];
}

export function parseAttestationId(attest: {
  provider: string;
  type: string;
  value: string;
  contactId: string;
}) {
  const attestKey = `${attest.contactId}:${attest.type}:${attest.value}:${attest.provider}`;
  return simpleHash(attestKey);
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
  console.log(`bl: fetching verifications`);
  const currentUserId = getCurrentUserId();
  const result = await scryNoun({
    app: 'lanyard',
    path: '/v1/records',
  });
  const records = nounToClientRecords(result, currentUserId);
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
  const work = ['twitter', 'post', postId];
  const payload = [null, ['work', identifier, work]];
  logger.log('confirmTwitterAttestation', payload);
  const noun = dwim(payload);
  console.log(`bl: poking for twitter confirm`, {
    noun,
    twitterHandle,
    postId,
  });
  await pokeNoun({ app: 'lanyard', mark: 'lanyard-command', noun });
  logger.log('confirmTwitterAttestation poke success');
  return;
}

export async function initiatePhoneAttestation(phoneNumber: string) {
  const payload = [null, ['start', ['phone', phoneNumber]]];
  logger.log('initiatePhoneAttestation', payload);
  const noun = dwim(payload);
  await pokeNoun({ app: 'lanyard', mark: 'lanyard-command', noun });
  logger.log('initiatePhoneAttestation poke success');
  return;
}

export async function confirmPhoneAttestation(
  phoneNumber: string,
  otp: string
) {
  const identifier = ['phone', phoneNumber];
  const work = ['phone', otp];
  const payload = [null, ['work', identifier, work]];
  logger.log('confirmPhoneAttestation', payload);
  const noun = dwim(payload);
  console.log(`bl: poking for phone confirm`, {
    noun,
    phoneNumber,
    otp,
  });
  await pokeNoun({ app: 'lanyard', mark: 'lanyard-command', noun });
  logger.log('confirmTwitterAttestation poke success');
  return;
}

export async function revokeAttestation(params: {
  type: db.VerificationType;
  value: string;
}) {
  const identifier = [params.type, params.value];
  const command = [null, ['revoke', identifier]];
  const noun = dwim(command);
  await pokeNoun({ app: 'lanyard', mark: 'lanyard-command', noun });
  logger.log('revokeAttestation poke success');
  return;
}
