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
  const sentAtMap = new Map<number, db.Post>();
  [...newPosts, ...pendingPosts].forEach((post) => {
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
  if (!existingPosts.length) return newAndPendingPosts;

  const lowerPaginationBound = existingPosts[existingPosts.length - 1].sentAt;
  const upperPaginationBound = hasNewest ? Infinity : existingPosts[0].sentAt;

  const filteredNewPosts = newAndPendingPosts.filter((p) => {
    return (
      p.sentAt > lowerPaginationBound &&
      p.sentAt < upperPaginationBound &&
      !existingPosts.some((existing) => existing.sentAt === p.sentAt)
    );
  });
  const finalPosts = [...filteredNewPosts, ...existingPosts];

  return finalPosts.filter((p) => {
    return (
      !p.isSequenceStub &&
      (!filterDeleted || (!p.isDeleted && !deletedPosts[p.id]))
    );
  });
};
