import { daToUnix, parseUw } from '@urbit/aura';
import { Atom, Cell, Noun, cue, dwim, enjs } from '@urbit/nockjs';

import * as db from '../db';
import { VerificationType } from '../db/schema';
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

function getSign(sign: string): Sign | null {
  const uw = parseUw(sign);
  const at = new Atom(uw);
  const noun = cue(at);
  const signTypeNoun = noun.at(Atom.fromInt(14)) as Noun | null; //   [%half when=@da for=@p kind=id-kind]
  if (!signTypeNoun) {
    throw 'Bad sign';
  }

  const signType = enjs.cord(signTypeNoun);
  if (!['half', 'full'].includes(signType)) {
    throw 'Bad sign';
  }

  // [when=@da for=@p kind=id-kind]
  function parseHalfSign(noun: Noun): HalfSign {
    if (!(noun instanceof Cell)) {
      throw 'Bad half sign';
    }

    const whenDa = enjs.cord(noun.head);
    const when = new Date(daToUnix(BigInt(whenDa))).getTime();
    if (!(noun.tail instanceof Cell)) {
      throw 'Bad half sign';
    }

    const b = noun.tail;

    const correspondingUser = b.head; // TODO: should check matches contactId
    const kind = enjs.cord(b.tail) as VerificationType;

    return { signType: 'half', when, kind };
  }

  const signValue = getFrondValue([
    // @ts-expect-error it's valid JSON, i swear
    { tag: 'half', get: parseHalfSign },
    { tag: 'full', get: () => 'todo' },
  ])(signTypeNoun);

  return null;
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
  const records = getRecords(result);

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
