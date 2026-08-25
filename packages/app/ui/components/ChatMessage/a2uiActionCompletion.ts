import * as db from '@tloncorp/shared/db';
import type { A2UIActionCompletion } from '../../contexts/componentsKits';

/**
 * Compute the same suffix completion for every chronological post in one
 * reverse pass. The scroller previously sliced and rescanned the remainder of
 * the conversation for every visible row, making long chats quadratic.
 */
export function getA2UIActionCompletions(
  posts: db.Post[],
  currentUserId: string,
  newestFirst = false
): A2UIActionCompletion[] {
  const completions = new Array<A2UIActionCompletion>(posts.length);
  let sentMessageText: string | undefined;

  const start = newestFirst ? 0 : posts.length - 1;
  const end = newestFirst ? posts.length : -1;
  const step = newestFirst ? 1 : -1;
  for (let index = start; index !== end; index += step) {
    completions[index] = {
      sentMessageText,
    };

    const candidate = posts[index];
    if (
      candidate.authorId !== currentUserId ||
      candidate.isDeleted ||
      candidate.deliveryStatus === 'failed'
    )
      continue;
    const text = candidate.textContent?.trim();
    if (text) {
      // Scanning from newest to oldest chronological post makes this the
      // earliest owner reply in the suffix, matching Array.find in the
      // per-post implementation.
      sentMessageText = candidate.textContent ?? undefined;
    }
  }

  return completions;
}
