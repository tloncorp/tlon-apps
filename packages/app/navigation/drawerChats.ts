import type * as db from '@tloncorp/shared/db';

import { isWorkspaceChat } from '../hooks/chatListFilters';

/**
 * The chats the drawer lists, newest first.
 *
 * Membership echoes the workspace list — the same groups and direct messages,
 * so the drawer never offers a chat that list does not. Order does not: that
 * screen keeps its three buckets apart, pinned chats at the top in the order
 * the user arranged them and invites in their own section, because it is where
 * those distinctions are acted on. Here the buckets are flattened and the only
 * thing that orders the list is when each chat last saw activity.
 */
export function getDrawerChats(
  chats: db.GroupedChats | null | undefined
): db.Chat[] {
  if (!chats) {
    return [];
  }
  return [...chats.pinned, ...chats.unpinned, ...chats.pending]
    .filter(isWorkspaceChat)
    .sort((a, b) => b.timestamp - a.timestamp);
}
