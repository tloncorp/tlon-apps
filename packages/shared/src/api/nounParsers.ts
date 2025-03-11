import { daToUnix, parseUw, patp } from '@urbit/aura';
import { Atom, Cell, Noun, cue, dwim, enjs } from '@urbit/nockjs';
import _ from 'lodash';

import * as db from '../db';
import { getFrondValue } from '../logic';

interface HalfSign {
  signType: 'half';
  when: number;
  provider?: string;
  type: db.VerificationType;
}

interface FullSign {
  signType: 'full';
  when: number;
  provider?: string;
  type: db.VerificationType;

  value: string;
  proofTweetId?: string;
}

type Sign = HalfSign | FullSign;

export function parseSigned(sign: string, userId: string): Sign | null {
  // the noun is encoded as a sign, first we have to unwrap it
  const uw = parseUw(sign);
  const at = new Atom(uw);
  // (signed ?(half-sign-data full-sign-data))
  const noun = cue(at);

  if (!(noun instanceof Cell)) {
    throw new Error('Bad Sign: not a cell');
  }

  const providerAtom = noun.head;
  if (!(providerAtom instanceof Atom)) {
    throw new Error('Bad Sign: provider not an atom');
  }
  const provider = patp(providerAtom.number);

  const TARGET = 59; // signed -> dat -> drop "0% %verified"
  const signTypeNoun = noun.at(Atom.fromInt(TARGET)) as Noun | null; // half-sign-data or full-sign-data
  if (!signTypeNoun) {
    throw new Error('Bad Sign: could not find dat');
  }

  // const signType = enjs.cord(signTypeNoun);
  // if (!['half', 'full'].includes(signType)) {
  //   throw 'Bad sign';
  // }

  const signValue = getFrondValue<Sign>([
    // @ts-expect-error it's valid JSON, i swear
    { tag: 'half', get: _.partial(parseHalfSign, userId) },
    // @ts-expect-error it's valid JSON, i swear
    { tag: 'full', get: _.partial(parseFullSign, userId) },
  ])(signTypeNoun);

  if (signValue) {
    signValue.provider = provider;
  }

  return signValue;
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

  const when = new Date(daToUnix(BigInt(noun.head.toString()))).getTime();
  if (!(noun.tail instanceof Cell)) {
    throw 'Bad half sign';
  }

  const b = noun.tail;

  if (!(b.head instanceof Atom)) {
    throw new Error('Bad Full Sign');
  }
  const correspondingUser = patp(b.head.number);
  console.log('check users match', {
    want: contactId,
    have: correspondingUser,
  });
  if (correspondingUser !== contactId) {
    throw new Error(`Signature user ID does not match contact`);
  }

  const c = b.tail;
  if (!(c instanceof Cell)) {
    throw new Error('Bad Half Sign');
  }

  const identifier = parseIdentifier(c.head);
  let proof = {} as Partial<FullSign>;

  const maybeProof = c.tail;
  if (maybeProof instanceof Cell) {
    proof = parseProof(maybeProof.tail);
  }

  return {
    signType: 'full',
    when,
    type: identifier.type,
    value: identifier.value,
    ...proof,
  };
}
