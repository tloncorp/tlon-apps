import type * as db from '@tloncorp/shared/db';

import { isWorkspaceChat } from '../hooks/chatListFilters';

/**
 * The chats the drawer lists, newest first.
 *
 * Membership echoes the workspace list — the same groups and direct messages,
 * bar the one the footer already carries. Order
 * does not: that screen keeps its three buckets apart, pinned chats at the top
 * in the order the user arranged them and invites in their own section,
 * because it is where those distinctions are acted on. Here the buckets are
 * flattened and the only thing that orders the list is when each chat last saw
 * activity.
 */
export function getDrawerChats(
  chats: db.GroupedChats | null | undefined,
  /**
   * The bot's own conversation, when the footer carries it as the `Chat`
   * button. It is a direct message like any other, so it would otherwise be
   * listed here as well — two rows for one conversation, reached by different
   * routes, lighting their unread separately, and disagreeing about whether
   * onboarding has them locked.
   */
  excludeChannelId?: string
): db.Chat[] {
  if (!chats) {
    return [];
  }
  return [...chats.pinned, ...chats.unpinned, ...chats.pending]
    .filter(
      (chat) =>
        isWorkspaceChat(chat) &&
        !(excludeChannelId != null && chat.id === excludeChannelId)
    )
    .sort((a, b) => b.timestamp - a.timestamp);
}
