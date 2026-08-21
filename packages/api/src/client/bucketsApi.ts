import type {
  BucketsAction,
  BucketsActionError,
  BucketsFlag,
  BucketsGrant,
  BucketsReadToken,
  BucketsRequestResponse,
  BucketsResponse,
  BucketsResponseBody,
  BucketsSnapshot,
} from '../urbit/buckets';
import { requestJson, scry, subscribe, unsubscribe } from './urbit';

const BUCKETS_APP = 'buckets';
const BUCKETS_V1_PATH = '/buckets/~/v1';
// The agent answers an unauthenticated request with 401, as %notes does, but
// requestJson only reauths on 403 by default. Without both, an expired Eyre
// cookie fails every Bucket action outright instead of refreshing once.
const BUCKETS_AUTH_FAILURE_STATUSES = [401, 403] as const;

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

export async function getBuckets() {
  return scry<BucketsSnapshot[]>({ app: BUCKETS_APP, path: '/v1/buckets' });
}

/**
 * Submit an action and wait for its terminal answer.
 *
 * The agent holds the request open until it has a real answer — including
 * across the network when the bucket lives on another ship — so there is no
 * correlation to do here. A `pending` body is never terminal and never
 * reaches us.
 */
export async function sendBucketsAction(
  action: BucketsAction
): Promise<BucketsResponseBody> {
  const res = await requestJson<BucketsRequestResponse>(
    BUCKETS_V1_PATH,
    'POST',
    { action },
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
export async function requestBucketsGrant(
  action: BucketsAction
): Promise<BucketsGrant> {
  const body = await sendBucketsAction(action);
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
export async function requestBucketReadToken(
  flag: BucketsFlag
): Promise<BucketsReadToken> {
  const body = await sendBucketsAction({ type: 'issue-bucket-read', flag });
  if (!('token' in body)) {
    throw new Error('%buckets issue-bucket-read did not return a token');
  }
  return body.token;
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
