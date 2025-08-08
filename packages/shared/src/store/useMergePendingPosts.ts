import * as db from '../db';

/**
 * Pending posts aren't assigned sequence numbers, so we need to weave them into the existing posts
 * we want to display based on what we do have (sentAt)
 *
 * @param pendingPosts An array of all pending posts for the channel, sorted newest first.
 * @param existingPosts A contiguous sequence of confirmed posts, sorted newest first.
 * @param hasNewest A boolean indicating if existingPosts represents the newest available messages.
 * @returns A single array of posts, sorted newest first, with relevant pending posts woven in.
 */
export const mergePendingPosts = ({
  pendingPosts,
  existingPosts,
  hasNewest,
}: {
  pendingPosts: db.Post[];
  existingPosts: db.Post[];
  hasNewest: boolean;
}): db.Post[] => {
  // --- Step 1: Handle Initial Edge Cases ---
  if (!existingPosts.length) {
    // If no existing posts, the list is just the pending posts.
    return pendingPosts;
  }

  if (!pendingPosts.length) {
    // If there are no pending posts, the list is just the existing posts.
    return existingPosts;
  }

  // --- Step 2: Establish the Filtering Window for pendingPosts ---
  const lowestBound = existingPosts[existingPosts.length - 1].sentAt;
  const highestBound = hasNewest ? Infinity : existingPosts[0].sentAt;

  // Filter out pending posts outside the chronological window.
  const relevantPendingPosts = pendingPosts.filter(
    (p) => p.sentAt > lowestBound && p.sentAt <= highestBound
  );

  // If no pending posts are relevant to this specific window, just return the existing posts.
  if (!relevantPendingPosts.length) {
    return existingPosts;
  }

  // --- Step 3: Perform a Two-Pointer Merge ---
  const mergedPosts: db.Post[] = [];
  let pendingPointer = 0;
  let existingPointer = 0;

  while (
    pendingPointer < relevantPendingPosts.length ||
    existingPointer < existingPosts.length
  ) {
    const currentPending = relevantPendingPosts[pendingPointer];
    const currentExisting = existingPosts[existingPointer];

    // Case A: Only pending posts remain
    if (!currentExisting) {
      mergedPosts.push(currentPending);
      pendingPointer++;
      continue;
    }

    // Case B: Only existing posts remain
    if (!currentPending) {
      mergedPosts.push(currentExisting);
      existingPointer++;
      continue;
    }

    // Case C: Deduplication (sentAt matches)
    // Assume if sentAt is identical, the pending post has become an existing post.
    // Prioritize the existing post as it is the "official" version.
    if (currentPending.sentAt === currentExisting.sentAt) {
      mergedPosts.push(currentExisting);
      pendingPointer++;
      existingPointer++;
      continue;
    }

    // Case D: Standard Merge (compare sentAt)
    // Push the chronologically newer post into the merged list.
    if (currentPending.sentAt > currentExisting.sentAt) {
      mergedPosts.push(currentPending);
      pendingPointer++;
    } else {
      mergedPosts.push(currentExisting);
      existingPointer++;
    }
  }

  return mergedPosts;
};
