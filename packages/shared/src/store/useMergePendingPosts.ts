import * as db from '../db';

/**
 * Pending posts aren't assigned sequence numbers, so we need to weave them into the existing posts
 * we want to display based on what we do have (sentAt)
 *
 * @param newPosts An array of posts that have come in since we started querying
 * @param pendingPosts An array of all pending posts for the channel, sorted newest first.
 * @param existingPosts A contiguous sequence of confirmed posts, sorted newest first.
 * @param deletedPosts A map of post IDs to a boolean indicating if the post has been deleted.
 * @param hasNewest A boolean indicating if existingPosts represents the newest available messages.
 * @param filterDeleted A boolean indicating if deleted posts should be filtered out.
 * @returns A single array of posts, sorted newest first, with relevant pending posts woven in.
 */
export const mergePendingPosts = ({
  newPosts,
  pendingPosts,
  existingPosts,
  deletedPosts,
  hasNewest,
  filterDeleted = false,
}: {
  newPosts: db.Post[];
  pendingPosts: db.Post[];
  existingPosts: db.Post[];
  deletedPosts: Record<string, boolean>;
  hasNewest: boolean;
  filterDeleted?: boolean;
}): db.Post[] => {
  const postMergeKeys = (post: db.Post) => {
    const keys = [`${post.channelId}:${post.sentAt}`];
    if (post.authorId) {
      keys.push(`${post.channelId}:${post.authorId}:${post.sentAt}`);
    }
    return keys;
  };
  const deletedPostKeys = new Set<string>();
  [...newPosts, ...pendingPosts, ...existingPosts].forEach((post) => {
    if (post.isDeleted || deletedPosts[post.id]) {
      postMergeKeys(post).forEach((key) => deletedPostKeys.add(key));
    }
  });
  const hasDeletedOverlay = (post: db.Post) => {
    return (
      post.isDeleted ||
      deletedPosts[post.id] ||
      postMergeKeys(post).some((key) => deletedPostKeys.has(key))
    );
  };

  // Drop **truly local-only** rows the user has locally cleared. The send
  // either failed outright or was never acknowledged by the server, so the
  // row can vanish immediately. Rows that are already server-acknowledged
  // (`deliveryStatus: 'sent'`) but still waiting on their sequenced
  // `addPost` event (`sequenceNum === 0`) — i.e., the `markPostSent`
  // catch-up window — must NOT be dropped; they fall through and get an
  // isDeleted tombstone overlay synthesized below. `needs_verification`
  // rows also may have reached the server, so keep them visible too.
  //
  // `sequenceNum === 0` alone is not enough to conclude "safe to drop":
  // the field only flips to a real value when the sequenced addPost
  // arrives, which is strictly after the server-acknowledgement.
  const isLocallyClearedOptimistic = (post: db.Post) =>
    post.sequenceNum === 0 &&
    hasDeletedOverlay(post) &&
    post.deliveryStatus === 'failed';
  // Stamp `isDeleted: true` on any surviving row the user has locally
  // cleared. This keeps confirmed echoes visible in the list (so the
  // tombstone slot is preserved) but flips them to the deleted-rendering path
  // immediately. A deleted DB-backed pending row may be filtered out by a
  // same-sentAt existing post below, so carry deletion by merge key as well as
  // exact id.
  const applyDeletedOverlay = (posts: db.Post[]) =>
    posts.map((p) =>
      !p.isDeleted && hasDeletedOverlay(p) ? { ...p, isDeleted: true } : p
    );
  const finalizePosts = (posts: db.Post[]) =>
    posts.filter((p) => {
      return !p.isSequenceStub && (!filterDeleted || !p.isDeleted);
    });
  const sentAtMap = new Map<number, db.Post>();
  [...newPosts, ...pendingPosts]
    .filter((post) => !isLocallyClearedOptimistic(post))
    .forEach((post) => {
      if (!sentAtMap.has(post.sentAt)) {
        sentAtMap.set(post.sentAt, post);
      }
    });
  const newAndPendingPosts = Array.from(sentAtMap.values()).sort((a, b) => {
    const aUnconfirmed = a.sequenceNum === 0;
    const bUnconfirmed = b.sequenceNum === 0;
    if (aUnconfirmed !== bUnconfirmed) return aUnconfirmed ? -1 : 1;
    return aUnconfirmed ? b.sentAt - a.sentAt : b.receivedAt - a.receivedAt;
  });
  if (!existingPosts.length) {
    return finalizePosts(applyDeletedOverlay(newAndPendingPosts));
  }

  // --- Step 2: Establish the Filtering Window for pendingPosts ---
  const lowerPaginationBound = existingPosts[existingPosts.length - 1].sentAt;
  const upperPaginationBound = hasNewest ? Infinity : existingPosts[0].sentAt;

  const filteredNewPosts = newAndPendingPosts.filter((p) => {
    return (
      p.sentAt > lowerPaginationBound &&
      p.sentAt < upperPaginationBound &&
      !existingPosts.some((existing) => existing.sentAt === p.sentAt)
    );
  });
  const finalPosts = applyDeletedOverlay([
    ...filteredNewPosts,
    ...existingPosts,
  ]);

  return finalizePosts(finalPosts);
};
