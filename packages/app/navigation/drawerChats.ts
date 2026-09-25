import type * as db from '@tloncorp/shared/db';

import { isDirectMessage, isWorkspaceChat } from '../hooks/chatListFilters';
import {
  type DrawerRow,
  chatRowHasUnread,
  getDrawerRows,
} from './drawerWorkspaceRows';

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
 * Whether the panel lists this chat under some tab.
 *
 * `excludeChannelId` is the bot's own conversation, when the footer carries it
 * as the `Tlonbot` button. It is a direct message like any other, so it would
 * otherwise be listed here as well — two rows for one conversation, reached by
 * different routes, lighting their unread separately, and disagreeing about
 * whether onboarding has them locked.
 */
function isDrawerChat(chat: db.Chat, excludeChannelId?: string): boolean {
  return (
    isWorkspaceChat(chat) &&
    !(excludeChannelId != null && chat.id === excludeChannelId)
  );
}

function allChats(chats: db.GroupedChats): db.Chat[] {
  return [...chats.pinned, ...chats.unpinned, ...chats.pending];
}

/**
 * The tabs holding a chat with an unread, so the one not being shown can say
 * it has something in it.
 *
 * Without this a partitioned list hides an unread completely: the rows that
 * would carry its dot are the rows the other tab is not drawing, and Activity
 * does not answer for it either — `getUnreadUnseenActivityEvents` takes only
 * events with `shouldNotify`, so an ordinary message in a chat the user is
 * simply a member of badges nothing. The combined list this replaced showed
 * every chat's unread state at once and owes the reader that much.
 *
 * Asks each chat exactly what its row asks, `chatRowHasUnread`, so a tab
 * cannot claim an unread none of its rows would show, or stay dark over one
 * they would.
 */
export function getUnreadDrawerFilters(
  chats: db.GroupedChats | null | undefined,
  excludeChannelId?: string
): DrawerFilter[] {
  if (!chats) {
    return [];
  }
  const unread = new Set<DrawerFilter>();
  for (const chat of allChats(chats)) {
    if (unread.size === DRAWER_FILTERS.length) {
      break;
    }
    if (!isDrawerChat(chat, excludeChannelId) || !chatRowHasUnread(chat)) {
      continue;
    }
    unread.add(isDirectMessage(chat) ? 'messages' : 'workspaces');
  }
  return DRAWER_FILTERS.filter((filter) => unread.has(filter));
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
  excludeChannelId?: string
): db.Chat[] {
  if (!chats) {
    return [];
  }
  return allChats(chats)
    .filter(
      (chat) =>
        isDrawerChat(chat, excludeChannelId) &&
        chatMatchesDrawerFilter(chat, filter)
    )
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Every chat the panel lists under either tab, newest first: what its search
 * looks through.
 *
 * Both halves at once, because the tabs are put away while the field is open.
 * A search is how the user gets somewhere they cannot see from here, and
 * making them first guess which half it is in would be asking the question the
 * search exists to spare them.
 */
export function getDrawerSearchChats(
  chats: db.GroupedChats | null | undefined,
  excludeChannelId?: string
): db.Chat[] {
  if (!chats) {
    return [];
  }
  return allChats(chats)
    .filter((chat) => isDrawerChat(chat, excludeChannelId))
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * A line of the panel's list: one of its rows, or the heading a search result
 * gives each half of the list.
 */
export type DrawerListRow =
  | DrawerRow
  | { kind: 'heading'; key: string; filter: DrawerFilter };

/**
 * A search's results, cut back into the two halves the tabs would have shown
 * them in and headed with those tabs' names.
 *
 * The tabs are hidden, but the difference they draw is not gone: a workspace
 * and a direct message are still different enough kinds of destination that
 * a list mixing them reads as a pile. So each half keeps the order the search
 * ranked it in, under its own heading, and a half with nothing in it has no
 * heading either.
 */
export function getDrawerSearchRows(
  results: db.Chat[],
  unfurledGroupId: string | null
): DrawerListRow[] {
  return DRAWER_FILTERS.flatMap((filter): DrawerListRow[] => {
    const matches = results.filter((chat) =>
      chatMatchesDrawerFilter(chat, filter)
    );
    if (!matches.length) {
      return [];
    }
    return [
      { kind: 'heading', key: `heading:${filter}`, filter },
      ...getDrawerRows(matches, unfurledGroupId),
    ];
  });
}
