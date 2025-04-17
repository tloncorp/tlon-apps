import { formatUv, formatUw, parseUw } from '@urbit/aura';
import { Atom, Cell, Noun, dejs, dwim, enjs } from '@urbit/nockjs';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
import { Json, getFrondValue, getPatp, simpleHash } from '../logic';
import * as ub from '../urbit';
import { stringToTa } from '../urbit';
import * as NounParsers from './nounParsers';
import {
  getCurrentUserId,
  pokeNoun,
  scryNoun,
  subscribe,
  subscribeOnce,
  trackedPokeNoun,
} from './urbit';

const logger = createDevLogger('lanyardApi', false);

export type LanyardUpdate = { type: 'Default' };
export function subscribeToLanyardUpdates(
  eventHandler: (event: LanyardUpdate) => void
) {
  subscribe({ app: 'lanyard', path: '/v1/records' }, (event) => {
    logger.log('raw lanyard sub event', event);
    eventHandler({ type: 'Default' });
  });
}

export async function checkAttestedSignature(signData: string) {
  const nonce = Math.floor(Math.random() * 1000000);
  const encodedNonce = formatUv(BigInt(nonce));

  const query = [
    null,
    [null, nonce],
    ['valid-jam', new Atom(parseUw(signData))],
  ];
  const noun = dwim(query);

  const queryResponseSub = subscribeOnce<ub.QueryResponseEvent>(
    {
      app: 'lanyard',
      path: `/v1/query/${encodedNonce}`,
    },
    undefined,
    undefined,
    { tag: 'checkAttestedSignature' }
  );

  await pokeNoun({ app: 'lanyard', mark: 'lanyard-query-1', noun });
  const queryResponse = await queryResponseSub;

  if (queryResponse) {
    const sigValidation = queryResponse.query?.result;
    return Boolean(sigValidation.live && sigValidation.valid);
  }
  return false;
}

export async function discoverContacts(phoneNums: string[]) {
  console.log(`bl: discovering contacts`, phoneNums);
  try {
    const nums = diffContactBook(phoneNums);
    // const lastSalt = formatUw('0');
    const payload = ['whose-bulk', 0, nums.last, nums.add, nums.del];
    const noun = dwim(payload);

    const nonce = Math.floor(Math.random() * 1000000);
    const encodedNonce = formatUv(BigInt(nonce));
    const queryResponseSub = subscribeOnce<ub.WhoseBulkResponseEvent>(
      {
        app: 'lanyard',
        path: `/v1/query/${encodedNonce}`,
      },
      undefined,
      undefined,
      { tag: 'discoverContacts' }
    );

    try {
      await pokeNoun({ app: 'lanyard', mark: 'lanyard-query-1', noun });
    } catch (e) {
      console.error('bl: poke error', e);
    }
    const queryResponse = await queryResponseSub;
    console.log(`bl: got whose bulk result`, queryResponse);

    if (queryResponse) {
      // return matches
      const nextSalt = queryResponse.result?.['next-salt'];
      const matches = queryResponse.result?.result
        ? Object.entries(queryResponse.result.result).filter(([_key, value]) =>
            Boolean(value)
          )
        : [];

      console.log(`bl: got matches`, matches);
      return matches;
    }

    console.log('bl: no results found');
    return [];
  } catch (e) {
    console.error('bl: error discovering contacts', e);
    throw e;
  }
}

function diffContactBook(phoneNums: string[]) {
  // TODO: diff last request
  return {
    last: toPhoneIdentifierSet([]),
    add: toPhoneIdentifierSet(phoneNums),
    del: toPhoneIdentifierSet([]),
  };
}

function toPhoneIdentifierSet(phoneNumbers: string[]) {
  return dejs.set(phoneNumbers.map((num) => ['phone', num]));
}

function nounToClientRecords(noun: Noun, contactId: string): db.Attestation[] {
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

    const type = enjs.cord(n.head.tail.head) as db.AttestationType;
    const value = getFrondValue([
      { tag: 'dummy', get: enjs.cord },
      { tag: 'phone', get: enjs.cord },
      { tag: 'urbit', get: getPatp },
      { tag: 'twitter', get: enjs.cord },
    ])(n.head.tail) as string;

    if (!(n.tail instanceof Cell)) {
      throw new Error('malformed record value');
    }

    const config = enjs.cord(n.tail.head) as db.AttestationDiscoverability;
    const a = n.tail.tail;
    if (!(a instanceof Cell)) {
      throw new Error('malformed record why');
    }
    const statusMessage = enjs.cord(a.head);

    const { status, sign } = getFrondValue<{
      status: db.AttestationStatus;
      sign: NounParsers.Sign | null;
    }>([
      { tag: 'want', get: () => ({ status: 'pending', sign: null }) },
      { tag: 'wait', get: () => ({ status: 'waiting', sign: null }) },
      {
        tag: 'done',
        get: (noun: Noun) => ({
          status: 'verified',
          sign: NounParsers.parseAttestation(noun),
        }),
      },
    ])(a.tail);

    const id = parseAttestationId({ provider, type, value, contactId });
    const provingTweetId =
      sign?.signType === 'full' ? sign.proofTweetId ?? null : null;

    const verif: db.Attestation = {
      id,
      contactId,
      provider,
      type,
      value,
      initiatedAt: sign?.when ?? null,
      discoverability: config,
      status,
      statusMessage,
      provingTweetId,
      signature: sign?.signature,
    };

    return verif as Json;
  })(noun) as unknown as db.Attestation[];
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

function parseTwitterBundle(noun: Noun) {
  if (!(noun instanceof Cell)) {
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

  try {
    const parsed = parseTwitterBundle(result);
    return parsed;
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorNounParse, {
      parser: 'twitterBundle',
      error: e,
      errorMessage: e.message,
      noun: result.toString(),
    });
    throw e;
  }
}

export async function fetchUserAttestations(): Promise<db.Attestation[]> {
  const currentUserId = getCurrentUserId();

  try {
    const result = await scryNoun({
      app: 'lanyard',
      path: '/v1/records',
    });

    try {
      const records = nounToClientRecords(result, currentUserId);
      return records;
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNounParse, {
        parser: 'records',
        error: e,
        errorMessage: e.message,
        noun: nounToClientRecords.toString(),
      });
      throw e;
    }
  } catch (e) {
    logger.trackEvent('Error Scrying Lanyard State', {
      error: e,
      errorMessage: e.message,
    });
    throw e;
  }
}

export async function initiatePhoneVerify(phoneNumber: string) {
  const payload = [null, ['start', ['phone', phoneNumber]]];
  const noun = dwim(payload);

  let errorCode: LanyardErrorCode | null = null;
  await trackedPokeNoun(
    { app: 'lanyard', mark: 'lanyard-command-1', noun },
    { app: 'lanyard', path: '/v1/records' },
    (event: ub.RecordStatusEvent) => {
      if (event.status?.value !== phoneNumber.toLowerCase()) {
        return false;
      }

      if (event.status.status === 'gone') {
        if (event.status.why.includes('already registered')) {
          errorCode = LanyardErrorCode.ALREADY_REGISTERED;
        } else {
          errorCode = LanyardErrorCode.UNKNOWN;
        }
        return true;
      }

      if (event.status.status === 'pending') {
        return true;
      }

      return false;
    },
    { tag: 'initiatePhoneVerify' }
  );

  if (errorCode) {
    throw new LanyardError({ errorCode });
  }
}

export async function initiateTwitterAttestation(twitterHandle: string) {
  const payload = [null, ['start', ['twitter', twitterHandle]]];
  logger.log('initiateTwitterAttestation', payload);
  const noun = dwim(payload);

  let errorCode: LanyardErrorCode | null = null;
  await trackedPokeNoun(
    { app: 'lanyard', mark: 'lanyard-command-1', noun },
    { app: 'lanyard', path: '/v1/records' },
    (event: ub.RecordStatusEvent) => {
      if (event.status?.value !== twitterHandle.toLowerCase()) {
        return false;
      }

      if (event.status.status === 'gone') {
        if (event.status.why.includes('already registered')) {
          errorCode = LanyardErrorCode.ALREADY_REGISTERED;
        } else {
          errorCode = LanyardErrorCode.UNKNOWN;
        }
        return true;
      }

      if (event.status.status === 'pending') {
        return true;
      }

      return false;
    },
    { tag: 'initiateTwitterAttestation' }
  );

  if (errorCode) {
    throw new LanyardError({ errorCode });
  }
}

export async function updateAttestationVisibility({
  visibility,
  value,
  type,
}: {
  value: string;
  type: db.AttestationType;
  visibility: db.AttestationDiscoverability;
}) {
  let backendVisibility = 'hidden';
  switch (visibility) {
    case 'discoverable':
      backendVisibility = 'verified';
      break;
    case 'public':
      backendVisibility = 'public';
      break;
    case 'hidden':
    default:
      backendVisibility = 'hidden';
      break;
  }

  const identifier = [type, value.toLowerCase()];
  const config = [backendVisibility];
  const command = [null, ['config', identifier, config]];

  const noun = dwim(command);
  await trackedPokeNoun(
    { app: 'lanyard', mark: 'lanyard-command-1', noun },
    { app: 'lanyard', path: '/v1/records' },
    (event: ub.RecordConfigEvent) => {
      if (event.config?.value !== value.toLowerCase()) {
        return false;
      }

      if (event.config.config.discoverable === backendVisibility) {
        return true;
      }

      return false;
    },
    { tag: 'updateAttestationVisibility' }
  );
}

export async function updateAttestationProfileDisplay({
  value,
  type,
  displaySetting,
}: {
  value: string;
  type: db.AttestationType;
  displaySetting: 'full' | 'half' | 'none';
}) {
  const identifier = [type, value.toLowerCase()];
  const command = [null, ['profile', identifier, displaySetting]];
  const noun = dwim(command);
  await pokeNoun({ app: 'lanyard', mark: 'lanyard-command-1', noun });
}

export enum LanyardErrorCode {
  ALREADY_REGISTERED = 'VALUE_ALREADY_REGISTERED',

  TWITTER_TWEET_NOT_FOUND = 'TWITTER_TWEET_NOT_FOUND',
  TWITTER_TWEET_PROTECTED = 'TWITTER_TWEET_PROTECTED',
  TWITTER_BAD_TWEET = 'TWITTER_BAD_TWEET',

  PHONE_BAD_OTP = 'PHONE_BAD_OTP',

  UNKNOWN = 'UNKNOWN',
}
export class LanyardError extends Error {
  public errorCode: LanyardErrorCode;

  constructor({ errorCode }: { errorCode: LanyardErrorCode }) {
    super(errorCode);
    this.name = 'LanyardError';
    this.errorCode = errorCode;
  }
}

const BAD_CONFIRM_ERROR = 'tweet rejected';
export async function confirmTwitterAttestation(
  twitterHandle: string,
  postId: string
) {
  const identifier = ['twitter', twitterHandle];
  const work = ['twitter', 'post', postId];
  const payload = [null, ['work', identifier, work]];

  const noun = dwim(payload);
  let errorCode: LanyardErrorCode | null = null;
  await trackedPokeNoun(
    { app: 'lanyard', mark: 'lanyard-command-1', noun },
    { app: 'lanyard', path: '/v1/records' },
    (event: ub.RecordStatusEvent) => {
      if (event.status?.value !== twitterHandle.toLowerCase()) {
        return false;
      }

      const why = event.status.why ?? '';
      if (why.includes(BAD_CONFIRM_ERROR)) {
        if (why.includes('protected')) {
          errorCode = LanyardErrorCode.TWITTER_TWEET_PROTECTED;
        } else if (why.includes('not-found')) {
          errorCode = LanyardErrorCode.TWITTER_TWEET_NOT_FOUND;
        } else if (why.includes('bad-tweet') || why.includes('bad-handle')) {
          errorCode = LanyardErrorCode.TWITTER_BAD_TWEET;
        } else {
          errorCode = LanyardErrorCode.UNKNOWN;
        }
        return true;
      }

      if (event.status.status === 'verified') {
        return true;
      }

      return false;
    },
    { tag: 'confirmTwitterAttestation' }
  );

  if (errorCode) {
    throw new LanyardError({ errorCode });
  }
}

export async function initiatePhoneAttestation(phoneNumber: string) {
  const payload = [null, ['start', ['phone', phoneNumber]]];
  const noun = dwim(payload);

  let errorCode: LanyardErrorCode | null = null;
  await trackedPokeNoun(
    { app: 'lanyard', mark: 'lanyard-command-1', noun },
    { app: 'lanyard', path: '/v1/records' },
    (event: ub.RecordStatusEvent) => {
      if (event.status?.value !== phoneNumber) {
        return false;
      }

      if (event.status.status === 'gone') {
        if (event.status.why.includes('already registered')) {
          errorCode = LanyardErrorCode.ALREADY_REGISTERED;
        } else {
          errorCode = LanyardErrorCode.UNKNOWN;
        }
        return true;
      }

      if (
        event.status.status === 'pending' ||
        event.status.status === 'verified'
      ) {
        return true;
      }

      return false;
    },
    { tag: 'initiatePhoneAttestation' }
  );

  if (errorCode) {
    throw new LanyardError({ errorCode });
  }
}

export async function confirmPhoneAttestation(
  phoneNumber: string,
  otp: string
) {
  const identifier = ['phone', phoneNumber];
  const work = ['phone', otp];
  const payload = [null, ['work', identifier, work]];

  const noun = dwim(payload);
  let errorCode: LanyardErrorCode | null = null;
  await trackedPokeNoun(
    { app: 'lanyard', mark: 'lanyard-command-1', noun },
    { app: 'lanyard', path: '/v1/records' },
    (event: ub.RecordStatusEvent) => {
      if (!event.status || event.status.value !== phoneNumber) {
        return false;
      }

      const { status, why } = event.status;

      if (status === 'pending' && why.includes('invalid otp')) {
        errorCode = LanyardErrorCode.PHONE_BAD_OTP;
        return true;
      }

      if (event.status.status === 'verified') {
        return true;
      }

      return false;
    },
    { tag: 'confirmPhoneAttestation' }
  );

  if (errorCode) {
    throw new LanyardError({ errorCode });
  }
}

export async function revokeAttestation(params: {
  type: db.AttestationType;
  value: string;
}) {
  const identifier = [params.type, params.value];
  const command = [null, ['revoke', identifier]];
  const noun = dwim(command);

  await trackedPokeNoun(
    { app: 'lanyard', mark: 'lanyard-command-1', noun },
    { app: 'lanyard', path: '/v1/records' },
    (event: ub.RecordStatusEvent) => {
      if (event.status?.value !== params.value.toLowerCase()) {
        return false;
      }

      if (event.status.status === 'gone') {
        return true;
      }

      return false;
    },
    { tag: 'revokeAttestation' }
  );
}
