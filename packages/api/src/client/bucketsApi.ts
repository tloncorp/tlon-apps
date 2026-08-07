import type {
  BucketsAction,
  BucketsFlag,
  BucketsResponse,
  BucketsSnapshot,
} from '../urbit/buckets';
import { poke, scry, subscribe, unsubscribe } from './urbit';

const BUCKETS_APP = 'buckets';
const BUCKETS_ACTION_MARK = 'buckets-action-1';

function normalizeBucketsSnapshot<T extends BucketsSnapshot>(snapshot: T): T {
  const state = snapshot.state as BucketsSnapshot['state'] & {
    writers?: string[];
  };

  return {
    ...snapshot,
    state: {
      ...state,
      // State versions before %2 used the reader roles as the implicit writer
      // roles. Keeping that interpretation here makes client/server upgrades
      // order-independent for already-live Buckets.
      writers: state.writers ?? state.readers,
    },
  } as T;
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
  const snapshots = await scry<BucketsSnapshot[]>({
    app: BUCKETS_APP,
    path: '/v1/buckets',
  });
  return snapshots.map(normalizeBucketsSnapshot);
}

export function sendBucketsAction(action: BucketsAction) {
  return poke({
    app: BUCKETS_APP,
    mark: BUCKETS_ACTION_MARK,
    json: action,
  });
}

export async function subscribeToBuckets(
  handler: (response: BucketsResponse) => void
) {
  const subscriptionId = await subscribe<BucketsResponse>(
    { app: BUCKETS_APP, path: '/v1' },
    (response) =>
      handler(
        response.type === 'snapshot'
          ? normalizeBucketsSnapshot(response)
          : response
      )
  );

  return () => unsubscribe(subscriptionId);
}
