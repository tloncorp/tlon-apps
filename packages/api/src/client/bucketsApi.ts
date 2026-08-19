import type {
  BucketsAction,
  BucketsActionError,
  BucketsFlag,
  BucketsGrant,
  BucketsRequestResponse,
  BucketsResponse,
  BucketsResponseBody,
  BucketsSnapshot,
} from '../urbit/buckets';
import { requestJson, scry, subscribe, unsubscribe } from './urbit';

const BUCKETS_APP = 'buckets';
const BUCKETS_V1_PATH = '/buckets/~/v1';

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
    { action }
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
 * Submit an action that mints a bearer token, and return it.
 *
 * Uploads, reads and deletes all answer with a grant; anything else answering
 * with one would be a backend change we should notice here rather than
 * silently ignore.
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
