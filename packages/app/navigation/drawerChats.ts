import type * as db from '@tloncorp/shared/db';

import { isDirectMessage, isWorkspaceChat } from '../hooks/chatListFilters';

/**
 * The two halves the panel's tabs cut its list into.
 *
 * A partition rather than a pair of narrowings of one longer list: the panel
 * is the app's whole navigation now, and a workspace and a direct message are
 * different enough kinds of destination that mixing them made the list read as
 * a pile. Every chat the panel would list falls in exactly one of these, so
 * nothing is reachable from neither tab.
 */
export type DrawerFilter = 'workspaces' | 'messages';

export const DRAWER_FILTER_LABELS: Record<DrawerFilter, string> = {
  workspaces: 'Workspaces',
  messages: 'Messages',
};

/**
 * Workspaces first: it is the section the app itself starts on, and it holds
 * the groups the user spends their day inside.
 */
export const DRAWER_FILTERS = Object.keys(
  DRAWER_FILTER_LABELS
) as DrawerFilter[];

export function chatMatchesDrawerFilter(
  chat: db.Chat,
  filter: DrawerFilter
): boolean {
  return isDirectMessage(chat) === (filter === 'messages');
}

/**
 * The chats the drawer lists under a tab, newest first.
 *
 * Membership echoes the workspace list — the same groups and direct messages,
 * bar the one the footer already carries — cut by whichever tab is showing.
 * Order does not: that screen keeps its three buckets apart, pinned chats at
 * the top in the order the user arranged them and invites in their own
 * section, because it is where those distinctions are acted on. Here the
 * buckets are flattened and the only thing that orders the list is when each
 * chat last saw activity.
 */
export function getDrawerChats(
  chats: db.GroupedChats | null | undefined,
  filter: DrawerFilter,
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
        chatMatchesDrawerFilter(chat, filter) &&
        !(excludeChannelId != null && chat.id === excludeChannelId)
    )
    .sort((a, b) => b.timestamp - a.timestamp);
}
