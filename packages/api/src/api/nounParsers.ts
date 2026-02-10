import { parse, render, da } from '@urbit/aura';
import { Atom, Cell, Noun, cue, dwim, enjs, jam } from '@urbit/nockjs';
import _ from 'lodash';

import * as db from '../db';
import { getFrondValue, getPatp, simpleHash } from '../logic';
import * as ub from '../urbit';

interface HalfSign {
  signType: 'half';
  signature?: string;
  when: number;
  provider?: string;
  type: db.AttestationType;
  contactId?: string;
}

interface FullSign {
  signType: 'full';
  signature?: string;
  when: number;
  provider?: string;
  type: db.AttestationType;

  value: string;
  proofTweetId?: string;
  contactId?: string;
}

export type Sign = HalfSign | FullSign;

export function parseSigned(sign: string): Sign | null {
  // the noun is @uw encoded, first we have to unwrap it
  const uw = parse('uw', sign);
  const at = new Atom(uw);
  const noun = cue(at); // (signed ?(half-sign-data full-sign-data))

  if (!(noun instanceof Cell)) {
    throw new Error('Bad Sign: not a cell');
  }

  const providerAtom = noun.head;
  if (!(providerAtom instanceof Atom)) {
    throw new Error('Bad Sign: provider not an atom');
  }
  const provider = render('p', providerAtom.number);

  const TARGET = 14; // TODO: mask instead of magic #
  const signedData = noun.at(Atom.fromInt(TARGET)) as Noun | null; // dat (signed-data)
  if (!signedData) {
    throw new Error('Bad Sign: could not find dat');
  }

  const signed = parseSignedData(signedData);
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
export function parseAttestation(noun: Noun) {
  // const mask = ex.mask(['_tag', '', '', ['attestation', '']]); TODO: mask instea of magic #

  const fullSignedData = noun.at(Atom.fromInt(30)) as Noun | null;
  if (!fullSignedData) {
    throw new Error('Bad attestation: could not find full signed data');
  }

  return parseSignedData(fullSignedData);
}

export function parseSignedData(noun: Noun) {
  const headTagged = getHeadTaggedAttestation(noun);
  const attestation = getFrondValue<Sign>([
    { tag: 'half', get: parseHalfSign },
    { tag: 'full', get: parseFullSign },
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
  type: db.AttestationType;
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
function parseHalfSign(noun: Noun): HalfSign {
  if (!(noun instanceof Cell)) {
    throw 'Bad half sign 1';
  }

  const when = new Date(da.toUnix(BigInt(noun.head.toString()))).getTime();
  if (!(noun.tail instanceof Cell)) {
    throw 'Bad half sign 2';
  }

  const b = noun.tail;

  if (!(b.head instanceof Atom)) {
    throw new Error('Bad half Sign 3');
  }

  const contactId = render('p', b.head.number);
  const type = enjs.cord(b.tail) as db.AttestationType;

  return { signType: 'half', when, type, contactId };
}

// [when=@da for=@p id=identifier proof=(unit proof)]
function parseFullSign(noun: Noun): FullSign {
  if (!(noun instanceof Cell)) {
    throw 'Bad full sign 1';
  }

  const when = new Date(da.toUnix(BigInt(noun.head.toString()))).getTime();
  if (!(noun.tail instanceof Cell)) {
    throw 'Bad full sign 2';
  }

  const b = noun.tail;

  if (!(b.head instanceof Atom)) {
    throw new Error('Bad full Sign 3');
  }
  const contactId = render('p', b.head.number);

  const c = b.tail;
  if (!(c instanceof Cell)) {
    throw new Error('Bad full Sign 4');
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
    contactId,
    type: identifier.type,
    value: identifier.value,
    ...proof,
  };
}

// [=config why=@t =status]
// function parseRecordEntry(
//   noun: Noun,
//   params: { currentUserId: string }
// ): db.Attestation {
//   // const axes = ex.mask(['id', 'config', 'why', 'status']);

//   // const id = ex.grab(axes, noun, 'id');
//   // const config = ex.grab(axes, noun, 'config');
//   // const why = ex.grab(axes, noun, 'why');
//   // const status = ex.grab(axes, noun, 'status');

//   const parser = enjs.pairs([
//     { nom: 'id', get: parseId },
//     { nom: 'config', get: parseConfig },
//     { nom: 'why', get: parseWhy },
//     { nom: 'status', get: parseStatus },
//   ]);

//   const result = parser(noun) as unknown as {
//     id: ub.RecordId;
//     config: db.AttestationDiscoverability;
//     why: string;
//     status: Partial<db.Attestation>;
//   };

//   return {
//     id: generateAttestationId({
//       ...result.id,
//       contactId: params.currentUserId,
//     }),
//     ...result.id,
//     ...result.status,
//     discoverability: result.config,
//   };
// }

// function parseId(noun: Noun): ub.RecordId {
//   const parser = enjs.pairs([
//     { nom: 'provider', get: getPatp },
//     { nom: 'type', get: enjs.cord },
//     { nom: 'value', get: (n: Noun) => n },
//   ]);

//   const result = parser(noun) as unknown as {
//     provider: string;
//     type: string;
//     value: Noun;
//   };

//   return {
//     provider: result.provider,
//     type: result.type,
//     value:
//       result.type === 'urbit' ? getPatp(result.value) : enjs.cord(result.value),
//   } as ub.RecordId;
// }

// export function generateAttestationId(attest: {
//   provider: string;
//   type: string;
//   value: string;
//   contactId: string;
// }) {
//   const attestKey = `${attest.contactId}:${attest.type}:${attest.value}:${attest.provider}`;
//   return simpleHash(attestKey);
// }

// function parseConfig(noun: Noun): db.AttestationDiscoverability {
//   return enjs.cord(noun) as db.AttestationDiscoverability;
// }

// function parseWhy(noun: Noun): string {
//   return enjs.cord(noun);
// }

// function parseStatus(noun: Noun) {
//   const { status, sign } = getFrondValue<{
//     status: db.AttestationStatus;
//     sign: Sign | null;
//   }>([
//     { tag: 'want', get: () => ({ status: 'pending', sign: null }) },
//     { tag: 'wait', get: () => ({ status: 'waiting', sign: null }) },
//     {
//       tag: 'done',
//       get: (noun: Noun) => ({
//         status: 'verified',
//         sign: parseAttestation(noun),
//       }),
//     },
//   ])(noun);

//   return {
//     status,
//     signature: sign?.signature,
//     initiatedAt: sign?.when,
//     provingTweetId: sign?.signType === 'full' ? sign.proofTweetId : null,
//   };
// }

// function nounToClientRecords(noun: Noun, contactId: string): db.Attestation[] {
//   console.log(`noun to client records`, noun);
//   return enjs.tree((n: Noun) => {
//     if (!(n instanceof Cell)) {
//       throw new Error('malformed map');
//     }

//     if (!(n.head instanceof Cell)) {
//       throw new Error('malformed record key');
//     }

//     const provider = getPatp(n.head.head) as string;

//     if (!(n.head.tail instanceof Cell)) {
//       throw new Error('malformed record key identifier');
//     }

//     const type = enjs.cord(n.head.tail.head) as db.AttestationType;
//     const value = getFrondValue([
//       { tag: 'dummy', get: enjs.cord },
//       { tag: 'phone', get: enjs.cord },
//       { tag: 'urbit', get: getPatp },
//       { tag: 'twitter', get: enjs.cord },
//     ])(n.head.tail) as string;

//     if (!(n.tail instanceof Cell)) {
//       throw new Error('malformed record value');
//     }

//     const config = enjs.cord(n.tail.head) as db.AttestationDiscoverability;
//     const currentUserId = '~latter-bolden'; // TODO: real curr user id
//     const a = n.tail.tail;
//     if (!(a instanceof Cell)) {
//       throw new Error('malformed record why');
//     }
//     const statusMessage = enjs.cord(a.head); // TODO: should we store?

//     const { status, sign } = getFrondValue<{
//       status: db.AttestationStatus;
//       sign: NounParsers.Sign | null;
//     }>([
//       { tag: 'want', get: () => ({ status: 'pending', sign: null }) },
//       { tag: 'wait', get: () => ({ status: 'waiting', sign: null }) },
//       {
//         tag: 'done',
//         get: (noun: Noun) => ({
//           status: 'verified',
//           sign: parseAttestation(noun, currentUserId),
//         }),
//       },
//     ])(a.tail);

//     const id = parseAttestationId({ provider, type, value, contactId });
//     const provingTweetId =
//       sign?.signType === 'full' ? sign.proofTweetId ?? null : null;

//     const verif: db.Attestation = {
//       id,
//       contactId,
//       provider,
//       type,
//       value,
//       initiatedAt: sign?.when ?? null,
//       discoverability: config,
//       status,
//       statusMessage,
//       provingTweetId,
//       signature: sign?.signature,
//     };

//     return verif;
//   })(noun) as unknown as db.Attestation[];
// }

// export function parseAttestationId(attest: {
//   provider: string;
//   type: string;
//   value: string;
//   contactId: string;
// }) {
//   const attestKey = `${attest.contactId}:${attest.type}:${attest.value}:${attest.provider}`;
//   return simpleHash(attestKey);
// }

// export function parseProof(noun: Noun) {
//   if (!(noun instanceof Cell)) {
//     throw new Error('malformed proof bundle, not a cell');
//   }

//   const head = noun.head;
//   const tail = noun.tail;

//   const payload = enjs.cord(head);
//   const url = enjs.cord(tail);

//   return { payload, url };
// }
