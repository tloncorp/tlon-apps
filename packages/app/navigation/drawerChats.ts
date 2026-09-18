import type * as db from '@tloncorp/shared/db';

import { isWorkspaceChat } from '../hooks/chatListFilters';

/**
 * How many chats the drawer lists.
 *
 * The list is not virtualised — a `FlashList` here leaves the drawer unable to
 * close — so every row it holds is a row mounted, and mounted again each time
 * the drawer opens. A bound keeps that cost the same for an account with four
 * thousand chats as for one with forty. It is a recency list, and the full set
 * is one row up on the workspace screen, which has search and its own
 * virtualised list.
 */
export const DRAWER_CHAT_LIMIT = 100;

/**
 * The chats the drawer lists, newest first.
 *
 * Membership echoes the workspace list — the same groups and direct messages,
 * so the drawer never offers a chat that list does not, up to `limit`. Order
 * does not: that screen keeps its three buckets apart, pinned chats at the top
 * in the order the user arranged them and invites in their own section,
 * because it is where those distinctions are acted on. Here the buckets are
 * flattened and the only thing that orders the list is when each chat last saw
 * activity.
 */
export function getDrawerChats(
  chats: db.GroupedChats | null | undefined,
  limit: number = DRAWER_CHAT_LIMIT
): db.Chat[] {
  if (!chats) {
    return [];
  }
  return [...chats.pinned, ...chats.unpinned, ...chats.pending]
    .filter(isWorkspaceChat)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}
