import * as db from '../../db';
import { QueryCtx } from '../../db/query';
import { removeFromChannelPosts } from '../useChannelPosts/subscriptions';

/**
 * Finish a delete that settled while its original send was still in flight,
 * once delivery finally resolves to `sent`.
 *
 * Deleting an optimistic post while its send is `enqueued`/`pending` can have
 * the delete acknowledged before delivery resolves, so the delete-time guarded
 * hard-delete matches nothing. Delivery later reaches `sent` through two paths
 * — `markPostSent` subscription events and `verifyPostDelivery` after a send
 * timeout — and both must run this cleanup, or the settled-delete row lingers
 * in a mounted channel's live snapshot as a tombstone until remount.
 *
 * `deleteSettledUnsequencedDeletedPost` guards on the settled-delete shape in
 * its DELETE predicate, so this can never remove a normally delivered post.
 */
export async function finishSettledDeleteOnDelivery(
  postId: string,
  ctx?: QueryCtx
) {
  const removed = await db.deleteSettledUnsequencedDeletedPost(postId, ctx);
  if (removed) {
    removeFromChannelPosts(removed);
    await db.recomputeChannelLastPost({ channelId: removed.channelId }, ctx);
  }
}
