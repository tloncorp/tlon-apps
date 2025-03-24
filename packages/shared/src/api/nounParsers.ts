import { daToUnix, parseUw, patp } from '@urbit/aura';
import { Atom, Cell, Noun, cue, dwim, enjs } from '@urbit/nockjs';
import _ from 'lodash';

import * as db from '../db';
import { getFrondValue } from '../logic';

interface HalfSign {
  signType: 'half';
  signature?: string;
  when: number;
  provider?: string;
  type: db.VerificationType;
}

interface FullSign {
  signType: 'full';
  signature?: string;
  when: number;
  provider?: string;
  type: db.VerificationType;

  value: string;
  proofTweetId?: string;
}

export type Sign = HalfSign | FullSign;

export function parseSigned(sign: string, userId: string): Sign | null {
  // the noun is @uw encoded, first we have to unwrap it
  const uw = parseUw(sign);
  const at = new Atom(uw);
  const noun = cue(at); // (signed ?(half-sign-data full-sign-data))

  if (!(noun instanceof Cell)) {
    throw new Error('Bad Sign: not a cell');
  }

  const providerAtom = noun.head;
  if (!(providerAtom instanceof Atom)) {
    throw new Error('Bad Sign: provider not an atom');
  }
  const provider = patp(providerAtom.number);

  const TARGET = 14;
  const signedData = noun.at(Atom.fromInt(TARGET)) as Noun | null; // dat (signed-data)
  if (!signedData) {
    throw new Error('Bad Sign: could not find dat');
  }

  const signed = parseSignedData(signedData, userId);
  if (signed) {
    signed.provider = provider;
    signed.signature = sign;
  }

  return signed;
}

/*
 +$  half-sign-data
  [%0 %verified %half when=@da for=@p kind=id-kind]
 +$  full-sign-data
  [%0 %verified %full when=@da for=@p id=identifier proof=(unit proof)]

  We want to drop the leading %0 and %verified
*/
export function getHeadTaggedAttestation(noun: Noun): Noun {
  if (!(noun instanceof Cell)) {
    throw new Error('getHeadTaggedAttestation: not a cell');
  }

  const tail = noun.tail;
  if (!(tail instanceof Cell)) {
    throw new Error('getHeadTaggedAttestation: tail is not a cell');
  }

  return tail.tail;
}

/*
+$  attestation
  $:  half=(signed half-sign-data)
      full=(signed full-sign-data)
  ==
*/
export function parseAttestation(noun: Noun, userId: string) {
  const fullSignedData = noun.at(Atom.fromInt(30)) as Noun | null;
  if (!fullSignedData) {
    throw new Error('Bad attestation: could not find full signed data');
  }

  return parseSignedData(fullSignedData, userId);
}

export function parseSignedData(noun: Noun, userId: string) {
  const headTagged = getHeadTaggedAttestation(noun);
  const attestation = getFrondValue<Sign>([
    { tag: 'half', get: _.partial(parseHalfSign, userId) },
    { tag: 'full', get: _.partial(parseFullSign, userId) },
  ])(headTagged);

  return attestation;
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
