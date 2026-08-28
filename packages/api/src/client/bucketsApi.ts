import type {
  BucketsAction,
  BucketsActionError,
  BucketsFlag,
  BucketsGrant,
  BucketsUploadGrant,
  BucketsReadToken,
  BucketsRequestResponse,
  BucketsResponse,
  BucketsResponseBody,
  BucketsSnapshot,
  BucketsSummary,
} from '../urbit/buckets';
import {
  BadResponseError,
  requestJson,
  scry,
  subscribe,
  unsubscribe,
} from './urbit';

const BUCKETS_APP = 'buckets';
const BUCKETS_V1_PATH = '/buckets/~/v1';
// The agent answers an unauthenticated request with 401, as %notes does, but
// requestJson only reauths on 403 by default. Without both, an expired Eyre
// cookie fails every Bucket action outright instead of refreshing once.
export const BUCKETS_AUTH_FAILURE_STATUSES: readonly number[] = [401, 403];

/**
 * A typed refusal from %buckets.
 *
 * The agent answers an action it won't perform with a reason rather than
 * crashing, so callers can tell "you can't do that" from "the request never
 * arrived".
 */
export class BucketsActionFailed extends Error {
  constructor(
    public readonly type: BucketsActionError,
    message: string
  ) {
    super(message);
    this.name = 'BucketsActionFailed';
  }
}

export function bucketsFlagKey(flag: BucketsFlag) {
  return `${flag.host}/${flag.name}`;
}

export function formatBucketsChannelId(flag: BucketsFlag) {
  return `buckets/${flag.host}/${flag.name}`;
}

export function parseBucketsChannelId(channelId: string): BucketsFlag | null {
  const [kind, host, name, ...rest] = channelId.split('/');
  if (kind !== 'buckets' || !host || !name || rest.length > 0) return null;
  return { host, name };
}

/**
 * Every bucket on this ship, without their contents.
 *
 * Entries are unbounded and nothing that lists buckets wants them, so this
 * costs the same whether they hold nothing or everything. Use getBucket for
 * one bucket's contents, or getBucketsFull for all of them at once.
 */
export async function getBuckets() {
  return scry<BucketsSummary[]>({ app: BUCKETS_APP, path: '/v1/buckets' });
}

export async function getBucketsFull() {
  return scry<BucketsSnapshot[]>({
    app: BUCKETS_APP,
    path: '/v1/buckets/full',
  });
}

/**
 * The current state of one bucket, or null if this ship does not have it.
 *
 * The agent drops a bucket from both this and /v1/buckets under exactly the
 * same conditions -- unknown flag, or subscribed but not yet synced -- so a
 * 404 here means what an absence from that list meant. Any other failure is
 * a failure and is raised, rather than being reported as a missing bucket
 * and blanking one that is really there.
 */
export async function getBucket(
  flag: BucketsFlag
): Promise<BucketsSnapshot | null> {
  try {
    const response = await scry<BucketsResponse>({
      app: BUCKETS_APP,
      path: `/v1/buckets/${flag.host}/${flag.name}`,
    });
    return response.type === 'snapshot'
      ? { flag: response.flag, state: response.state }
      : null;
  } catch (e) {
    if (e instanceof BadResponseError && e.status === 404) return null;
    throw e;
  }
}

/**
 * Whether %buckets is installed and running on this ship.
 *
 * A constant-size read. Asking /v1/buckets for this instead serialises every
 * bucket's whole manifest -- entries, names, sizes, checksums -- to answer a
 * yes/no, and so got slower the more anyone stored.
 */
export async function getBucketsReady() {
  return scry<boolean>({ app: BUCKETS_APP, path: '/v1/ready' });
}

/**
 * Submit an action and wait for its terminal answer.
 *
 * The agent holds the request open until it has a real answer — including
 * across the network when the bucket lives on another ship — so there is no
 * correlation to do here. A `pending` body is never terminal and never
 * reaches us.
 */
const UV_DIGITS = '0123456789abcdefghijklmnopqrstuv';

/**
 * A request id of our own choosing.
 *
 * The agent keys both its deduplication and its /request/<id> lookup on this,
 * and mints one itself when we leave it out -- which leaves the caller holding
 * an id it never saw, so a lost response cannot be polled for and cannot be
 * safely retried. A non-idempotent action is exactly where that matters: a
 * dropped %begin-upload answer strands a session, and retrying opens another.
 *
 * Written in @uv's canonical shape -- 0v, then dot-separated groups of five
 * base-32 digits -- because the agent parses it with (slav %uv) and quietly
 * falls back to its own id for anything that does not parse.
 */
export function mintRequestId(): string {
  const bytes = new Uint8Array(25);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const digits = Array.from(bytes, (byte) => UV_DIGITS[byte & 31]);
  // A leading zero is not a shape +scot would ever produce, so do not send one.
  if (digits[0] === '0') digits[0] = '1';
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 5) {
    groups.push(digits.slice(i, i + 5).join(''));
  }
  return `0v${groups.join('.')}`;
}

/**
 * Submit an action and wait for its terminal answer, reporting the id it was
 * submitted under.
 *
 * The id is what makes a lost answer recoverable -- /request/<id> reads the
 * result, and resubmitting under it is answered from the record rather than
 * run again -- so a caller that means to recover has to be able to learn it
 * before the answer arrives, not from the answer.
 */
export async function submitBucketsAction(
  action: BucketsAction,
  requestId: string = mintRequestId()
): Promise<{ requestId: string; body: BucketsResponseBody }> {
  return { requestId, body: await sendBucketsAction(action, requestId) };
}

export async function sendBucketsAction(
  action: BucketsAction,
  requestId: string = mintRequestId()
): Promise<BucketsResponseBody> {
  const res = await requestJson<BucketsRequestResponse>(
    BUCKETS_V1_PATH,
    'POST',
    { action, requestId },
    { reauthStatuses: BUCKETS_AUTH_FAILURE_STATUSES }
  );
  const body = res?.body;
  if (!body) {
    throw new Error('%buckets response missing body');
  }
  if ('error' in body) {
    throw new BucketsActionFailed(body.error.type, body.error.message);
  }
  return body;
}

/**
 * Submit an action that mints a per-object bearer token, and return it.
 *
 * Uploads and deletes answer with a grant, because both name one object.
 * Reads do not: one token covers the whole bucket, so they answer with a
 * token instead -- see getBucketReadToken.
 */
/**
 * Open an upload and get back where to PUT its bytes.
 *
 * The host calls the storage broker on our behalf and holds this request open
 * until it has an answer, so there is one round trip here rather than a token
 * to carry onward.
 */
export async function requestBucketsUpload(
  action: BucketsAction,
  requestId?: string
): Promise<BucketsUploadGrant> {
  const body = await sendBucketsAction(action, requestId);
  if (!('upload' in body)) {
    throw new Error(`%buckets ${action.type} did not return an upload grant`);
  }
  return body.upload;
}

export async function requestBucketsGrant(
  action: BucketsAction,
  requestId?: string
): Promise<BucketsGrant> {
  const body = await sendBucketsAction(action, requestId);
  if (!('grant' in body)) {
    throw new Error(`%buckets ${action.type} did not return a grant`);
  }
  return body.grant;
}

/**
 * The bucket read token our own ship currently holds.
 *
 * The ship keeps this fresh on a timer, so this is a local read with no
 * network hop — and no call to the bucket's host. Null means we hold none
 * yet, which a cold start resolves by asking for one; the catch also covers
 * a genuine failure, and the caller treats both the same way.
 */
export async function getBucketReadToken(
  flag: BucketsFlag
): Promise<BucketsReadToken | null> {
  return scry<BucketsReadToken | null>({
    app: BUCKETS_APP,
    path: `/v1/buckets/${flag.host}/${flag.name}/read-token`,
  }).catch(() => null);
}

/**
 * Ask the ship to mint a read token now rather than waiting for its timer.
 *
 * Only needed on a cold start, when nothing has asked for this bucket yet.
 */
// In-flight mints, shared by everything in this context rather than held per
// caller. The host tracks one waiting request per bucket and reader and denies
// the one a later grant supersedes, so two callers minting at once cost one of
// them an "access changed" failure on a bucket they may read perfectly well.
//
// This does not reach across tabs, which have their own module scope. Two tabs
// opening the same cold bucket at the same instant can still collide; making
// that impossible needs the host to hold more than one waiter, not more
// bookkeeping here.
const inFlightMints = new Map<string, Promise<BucketsReadToken>>();

export async function requestBucketReadToken(
  flag: BucketsFlag
): Promise<BucketsReadToken> {
  const key = bucketsFlagKey(flag);
  const existing = inFlightMints.get(key);
  if (existing) return existing;

  const mint = (async () => {
    const body = await sendBucketsAction({ type: 'issue-bucket-read', flag });
    if (!('token' in body)) {
      throw new Error('%buckets issue-bucket-read did not return a token');
    }
    return body.token;
  })();
  inFlightMints.set(key, mint);
  // Cleared on settle, so a failure is retried rather than cached.
  void mint
    .catch(() => undefined)
    .finally(() => {
      if (inFlightMints.get(key) === mint) inFlightMints.delete(key);
    });
  return mint;
}

export async function subscribeToBuckets(
  handler: (response: BucketsResponse) => void
) {
  let activeSubscriptionId: number | null = null;
  const subscriptionId = await subscribe<BucketsResponse>(
    { app: BUCKETS_APP, path: '/v1' },
    handler,
    {
      onSubscriptionId: (id) => {
        activeSubscriptionId = id;
      },
    }
  );
  activeSubscriptionId ??= subscriptionId;

  return () =>
    activeSubscriptionId === null
      ? Promise.resolve()
      : unsubscribe(activeSubscriptionId);
}
