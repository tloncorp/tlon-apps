import * as db from '@tloncorp/shared/db';
import type { A2UIActionCompletion } from '../../contexts/componentsKits';

/**
 * Compute the same suffix completion for every chronological post in one
 * reverse pass. The scroller previously sliced and rescanned the remainder of
 * the conversation for every visible row, making long chats quadratic.
 */
export function getA2UIActionCompletions(
  posts: db.Post[],
  currentUserId: string
): A2UIActionCompletion[] {
  const completions = new Array<A2UIActionCompletion>(posts.length);
  let sentMessageText: string | undefined;

  for (let index = posts.length - 1; index >= 0; index -= 1) {
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
      // Moving backwards makes this the earliest owner reply in the suffix,
      // matching Array.find in getA2UIActionCompletion.
      sentMessageText = candidate.textContent ?? undefined;
    }
  }

  return completions;
}
