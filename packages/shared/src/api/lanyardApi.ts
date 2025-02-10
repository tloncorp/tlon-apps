import { Cell, Noun, dwim, enjs } from '@urbit/nockjs';

import * as db from '../db';
import { getFrondValue, getPatp } from '../logic';
import { pokeNoun, scryNoun } from './urbit';

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

export async function fetchVerifications(): Promise<db.Verification[]> {
  const result = await scryNoun({
    app: 'lanyard',
    path: '/records',
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
