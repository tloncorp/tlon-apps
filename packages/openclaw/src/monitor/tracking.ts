import { createDedupeCache } from 'openclaw/plugin-sdk/core';

const PARTICIPATED_THREAD_LIMIT = 2_000;

export function createParticipatedThreadTracker(
  limit = PARTICIPATED_THREAD_LIMIT
) {
  const cache = createDedupeCache({ ttlMs: 0, maxSize: limit });

  return {
    add: (parentId: string) => {
      cache.check(parentId);
    },
    has: (parentId: string) => {
      if (!cache.peek(parentId)) {
        return false;
      }
      // Mention-free replies refresh recency before older participation is evicted.
      cache.check(parentId);
      return true;
    },
  };
}
