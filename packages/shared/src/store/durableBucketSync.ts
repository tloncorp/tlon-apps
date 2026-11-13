import { type BucketsState, parseBucketsChannelId } from '@tloncorp/api';
import type { DurableClient } from '@tloncorp/api/client/durable';
import { durableBucketState } from '@tloncorp/api/client/durableBuckets';

import * as db from '../db';
import { batchEffects, withTransactionCtx } from '../db/query';
import { DurableRoomSync } from './durableRoomSync';
import { handleBucketsUpdate } from './sync/sync';

/**
 * Keeps one open Bucket's manifest current on Slab, where it changes with its
 * room: a room event rereads the snapshot, unless the server answers that it
 * is still at the revision already applied, and reduces it as the %buckets
 * subscription would. A Bucket that is gone or out of reach is cleared.
 */
export function durableBucketSync(
  client: DurableClient,
  channelId: string,
  onError: (error: Error | null) => void
) {
  const flag = parseBucketsChannelId(channelId)!;
  const room = client.room(channelId);
  return new DurableRoomSync<{
    cursor: number;
    more: boolean;
    state: BucketsState | null | 'unchanged';
  }>({
    connect: () => client.events(room.id),
    read: async (after) => {
      const state = await durableBucketState(client, channelId, after);
      const cursor = state === 'unchanged' ? after : (state?.revision ?? 0);
      return { cursor, more: false, state };
    },
    apply: async ({ state }) => {
      if (state === 'unchanged') return;
      await batchEffects('durableBucket', (ctx) =>
        withTransactionCtx(ctx, (tx) =>
          state
            ? handleBucketsUpdate({ type: 'snapshot', flag, state }, tx)
            : db.deleteBucket(channelId, tx)
        )
      );
    },
    status: () => {},
    error: onError,
  });
}
