import { render, parse } from '@urbit/aura';
import { Atom, Cell, Noun, dejs, dwim, enjs } from '@urbit/nockjs';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
import { Json, getFrondValue, getPatp, simpleHash } from '../logic';
import * as ub from '../urbit';
import { encodeString } from '../urbit';
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
  const encodedNonce = render('uv', BigInt(nonce));

  const query = [
    null,
    [null, nonce],
    ['valid-jam', new Atom(parse('uw', signData))],
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

export async function discoverContacts(
  phoneNums: string[],
  storedLastSalt: string | null = null,
  lastPhoneNumberSetSent: string | null = null
): Promise<{ matches: [string, string][]; nextSalt: string | null }> {
  try {
    const nums = await diffContactBook(phoneNums, lastPhoneNumberSetSent);
    // because parseUx doesn't actually remove the dots
    const parsedLastSalt = storedLastSalt?.replaceAll('.', '') ?? '0x0';
    const lastSalt = BigInt(parsedLastSalt);
    const nonce = Math.floor(Math.random() * 1000000);
    const encodedNonce = render('uv', BigInt(nonce));
    const payload = [
      null,
      [null, nonce],
      'whose-bulk',
      lastSalt,
      nums.last,
      nums.add,
      nums.del,
    ];
    const noun = dwim(payload);

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
      logger.trackEvent(AnalyticsEvent.ErrorContactMatching, {
        error: e,
        errorMessage: e.message,
        context: 'discoverContacts',
      });
    }
    try {
      const queryResponse = await queryResponseSub;
      logger.log('discoverContacts: queryResponse', queryResponse);

      if (queryResponse && queryResponse.query.nonce === encodedNonce) {
        if (queryResponse.query.result === 'rate limited') {
          logger.trackEvent(AnalyticsEvent.ErrorContactMatching, {
            error: 'rate limited',
            context: 'discoverContacts',
            errorMessage: 'rate limited',
          });
          return {
            matches: [],
            nextSalt: null,
          };
        }

        // always store the phone numbers we just successfully sent, will be used to diff
        // against the next time we send a request
        const nextSalt = queryResponse.query.result?.['next-salt'];
        const matches = queryResponse.query.result?.results
          ? (Object.entries(queryResponse.query.result.results).filter(
              ([_key, value]) => Boolean(value)
            ) as [string, string][])
          : [];

        return {
          matches,
          nextSalt,
        };
      }

      return {
        matches: [],
        nextSalt: null,
      };
    } catch (e) {
      logger.error('error in discoverContacts', e);
      logger.trackEvent(AnalyticsEvent.ErrorContactMatching, {
        context: 'discoverContacts',
        error: e,
        errorMessage: e.message,
      });
      throw e;
    }
  } catch (e) {
    logger.error('error discovering contacts', e);
    throw e;
  }
}

async function diffContactBook(phoneNums: string[], last: string | null) {
  logger.log('diffContactBook: last phone contact set', last);

  if (last) {
    const lastSet = JSON.parse(last);
    logger.log('diffContactBook: lastSet', lastSet);

    // find new phone numbers (additions)
    const diff = phoneNums.filter((num) => !lastSet.includes(num));
    logger.log('diffContactBook: diff', diff);
    logger.trackEvent(AnalyticsEvent.DebugContactMatching, {
      context: 'diffContactBook',
      diffSetLength: diff.length,
    });
    // find removed phone numbers (deletions)
    const delSet = lastSet.filter((num: string) => !phoneNums.includes(num));
    logger.log('diffContactBook: delSet', delSet);
    logger.trackEvent(AnalyticsEvent.DebugContactMatching, {
      context: 'diffContactBook',
      delSetLength: delSet.length,
    });

    if (diff.length === 0 && delSet.length === 0) {
      logger.log('diffContactBook: no changes, returning empty with lastSet');
      return {
        last: toPhoneIdentifierSet(lastSet),
        add: toPhoneIdentifierSet([]),
        del: toPhoneIdentifierSet([]),
      };
    } else {
      logger.log('diffContactBook: returning diff and del', diff, delSet);
      return {
        last: toPhoneIdentifierSet(lastSet),
        add: toPhoneIdentifierSet(diff),
        del: toPhoneIdentifierSet(delSet),
      };
    }
  }

  logger.log('diffContactBook: no last set, returning with add');
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
    path: `/v1/proof/twitter/bundle/${encodeString(handle)}`,
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

export async function updateAttestationDiscoverability({
  visibility,
  value,
  type,
}: {
  value: string;
  type: db.AttestationType;
  visibility: db.AttestationDiscoverability;
}) {
  const identifier = [type, value.toLowerCase()];
  const config = [visibility];
  const command = [null, ['config', identifier, config]];

  const noun = dwim(command);
  await trackedPokeNoun(
    { app: 'lanyard', mark: 'lanyard-command-1', noun },
    { app: 'lanyard', path: '/v1/records' },
    (event: ub.RecordConfigEvent) => {
      if (event.config?.value !== value.toLowerCase()) {
        return false;
      }

      if (event.config.config.discoverable === visibility) {
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
