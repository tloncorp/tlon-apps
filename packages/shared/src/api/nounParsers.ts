import { daToUnix, parseUw } from '@urbit/aura';
import { Atom, Cell, Noun, cue, dwim, enjs } from '@urbit/nockjs';
import _ from 'lodash';

import * as db from '../db';
import { getFrondValue } from '../logic';

interface HalfSign {
  signType: 'half';
  when: number;
  type: db.VerificationType;
}

interface FullSign {
  signType: 'full';
  when: number;
  type: db.VerificationType;

  value: string;
  proofTweetId?: string;
  proofPhoneUrl?: string;
}

type Sign = HalfSign | FullSign;

export function parseSign(sign: string, userId: string): Sign | null {
  // the noun is encoded as a sign, first we have to unwrap it
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

  const signValue = getFrondValue([
    // @ts-expect-error it's valid JSON, i swear
    { tag: 'half', get: _.partial(parseHalfSign, userId) },
    // @ts-expect-error it's valid JSON, i swear
    { tag: 'full', get: _.partial(parseFullSign, userId) },
  ])(signTypeNoun);

  return signValue as Sign | null;
}

/*
=/  id-type
  $%  [%dummy @t]
      [%urbit @p]
      [%phone @t]      ::  normalized phone nr, a la +31612345678
      [%twitter @t]    ::  lowercased handle
      [%website turf]  ::  domain, tld first
  ==
*/
function parseIdentifier(input: Noun): {
  type: db.VerificationType;
  value: string;
} {
  if (!(input instanceof Cell)) {
    throw new Error('Bad identifier: not a cell');
  }

  const type = enjs.cord(input.head);
  const value = enjs.cord(input.tail);

  if (type !== 'twitter' && type !== 'phone') {
    throw new Error(`Bad identifier: invalid type ${type}`);
  }

  return { type, value };
}

/*
+$  proof
  $%  [%link @t]
      [%tweet id=@t]
  ==
*/
function parseProof(input: Noun): {
  proofTweetId?: string;
  proofPhoneUrl?: string;
} {
  if (!(input instanceof Cell)) {
    throw new Error('Bad identifier: not a cell');
  }

  const proofType = enjs.cord(input.head);
  const proofValue = enjs.cord(input.tail);

  if (proofType === 'tweet') {
    return { proofTweetId: proofValue };
  }

  if (proofType === 'phone') {
    return { proofPhoneUrl: proofValue };
  }

  throw new Error(`Bad proof: invalid type ${proofType}`);
}

// [when=@da for=@p kind=id-kind]
function parseHalfSign(contactId: string, noun: Noun): HalfSign {
  if (!(noun instanceof Cell)) {
    throw 'Bad half sign';
  }

  const whenDa = enjs.cord(noun.head);
  const when = new Date(daToUnix(BigInt(whenDa))).getTime();
  if (!(noun.tail instanceof Cell)) {
    throw 'Bad half sign';
  }

  const b = noun.tail;

  const correspondingUser = enjs.cord(b.head);
  if (correspondingUser !== contactId) {
    throw new Error(`Signature user ID does not match contact`);
  }

  const type = enjs.cord(b.tail) as db.VerificationType;

  return { signType: 'half', when, type };
}

// [when=@da for=@p id=identifier proof=(unit proof)]
function parseFullSign(contactId: string, noun: Noun): FullSign {
  if (!(noun instanceof Cell)) {
    throw 'Bad full sign';
  }

  const whenDa = enjs.cord(noun.head);
  const when = new Date(daToUnix(BigInt(whenDa))).getTime();
  if (!(noun.tail instanceof Cell)) {
    throw 'Bad half sign';
  }

  const b = noun.tail;

  const correspondingUser = enjs.cord(b.head);
  if (correspondingUser !== contactId) {
    throw new Error(`Signature user ID does not match contact`);
  }

  const c = b.tail;
  if (!(c instanceof Cell)) {
    throw new Error('Bad Half Sign');
  }

  const identifier = parseIdentifier(c.head);
  const proof = parseProof(c.tail);

  return {
    signType: 'full',
    when,
    type: identifier.type,
    value: identifier.value,
    ...proof,
  };
}
