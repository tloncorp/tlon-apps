import type * as db from '@tloncorp/shared/db';

import { isDirectMessage, isWorkspaceChat } from '../hooks/chatListFilters';
import {
  type DrawerRow,
  channelRecency,
  chatRowUnread,
  getDrawerMatchRows,
  getDrawerRows,
  getUnfurlableChannels,
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
 * What each tab's half of the list is holding: the tabs with a chat whose row
 * lights a dot, and whether any of those rows lights the accent one.
 */
export type DrawerFilterUnreads = Partial<
  Record<DrawerFilter, 'quiet' | 'notified'>
>;

/**
 * The tabs holding a chat with an unread, so the one not being shown can say
 * it has something in it — and, when one of those chats notified, that it is
 * something the user asked to be told about rather than just traffic.
 *
 * Without this a partitioned list hides an unread completely: the rows that
 * would carry its dot are the rows the other tab is not drawing, and Activity
 * does not answer for it either — `getUnreadUnseenActivityEvents` takes only
 * events with `shouldNotify`, so an ordinary message in a chat the user is
 * simply a member of badges nothing. The combined list this replaced showed
 * every chat's unread state at once and owes the reader that much.
 *
 * Asks each chat exactly what its row asks, `chatRowUnread`, so a tab cannot
 * claim an unread none of its rows would show, or stay dark over one they
 * would, or take the accent when none of them would.
 */
export function getDrawerFilterUnreads(
  chats: db.GroupedChats | null | undefined,
  excludeChannelId?: string
): DrawerFilterUnreads {
  const unreads: DrawerFilterUnreads = {};
  if (!chats) {
    return unreads;
  }
  for (const chat of allChats(chats)) {
    if (DRAWER_FILTERS.every((filter) => unreads[filter] === 'notified')) {
      break;
    }
    if (!isDrawerChat(chat, excludeChannelId)) {
      continue;
    }
    const unread = chatRowUnread(chat);
    if (unread === 'none') {
      continue;
    }
    const filter = isDirectMessage(chat) ? 'messages' : 'workspaces';
    // A notified chat answers for its tab over any quiet one beside it.
    if (unreads[filter] !== 'notified') {
      unreads[filter] = unread;
    }
  }
  return unreads;
}

export type DrawerTabChats = { pinned: db.Chat[]; unpinned: db.Chat[] };

/**
 * The chats the drawer lists under a tab: the ones the user pinned, in the
 * order they arranged them, and then everything else, newest first.
 *
 * Membership echoes the workspace list — the same groups and direct messages,
 * bar the one the footer already carries — cut by whichever tab is showing.
 * Pinned chats keep their own section at the top of each tab, as they do at
 * the top of that list. The rest are flattened, invites included, and the only
 * thing that orders them is when each chat last saw activity.
 */
export function getDrawerChats(
  chats: db.GroupedChats | null | undefined,
  filter: DrawerFilter,
  excludeChannelId?: string
): DrawerTabChats {
  if (!chats) {
    return { pinned: [], unpinned: [] };
  }
  const inTab = (chat: db.Chat) =>
    isDrawerChat(chat, excludeChannelId) &&
    chatMatchesDrawerFilter(chat, filter);
  return {
    pinned: chats.pinned.filter(inTab),
    unpinned: [...chats.unpinned, ...chats.pending]
      .filter(inTab)
      .sort((a, b) => b.timestamp - a.timestamp),
  };
}

/**
 * Whether a chat is a channel inside a workspace.
 *
 * The search finds one of these by its own name alone. Its workspace's name
 * would find every channel in it, so a search for the workspace would come
 * back with all of them; its id carries the host's name and the channel's
 * kind, so a search for a ship, or for "chat", would too.
 */
export function isWorkspaceChannelChat(chat: db.Chat): boolean {
  return chat.type === 'channel' && chat.channel.groupId != null;
}

/**
 * A channel of a workspace, as a chat the search can rank among the rest.
 */
function workspaceChannelChat(channel: db.Channel): db.Chat {
  return {
    id: channel.id,
    type: 'channel',
    channel,
    pin: null,
    volumeSettings: channel.volumeSettings ?? null,
    timestamp: channelRecency(channel),
    isPending: false,
    unreadCount: channel.unread?.count ?? 0,
  };
}

/**
 * Every chat the panel lists under either tab, and the channels inside each
 * workspace, newest first: what its search looks through.
 *
 * Both halves at once, because the tabs are put away while the field is open.
 * A search is how the user gets somewhere they cannot see from here, and
 * making them first guess which half it is in would be asking the question the
 * search exists to spare them. For the same reason it looks inside the
 * workspaces: a channel is a place the user goes as often as a workspace is.
 *
 * A channel pinned out of its workspace is searched as one of the
 * workspace's, not again on its own, so it comes back once, under the
 * workspace it belongs to.
 */
export function getDrawerSearchChats(
  chats: db.GroupedChats | null | undefined,
  excludeChannelId?: string
): db.Chat[] {
  if (!chats) {
    return [];
  }
  const listed = allChats(chats).filter((chat) =>
    isDrawerChat(chat, excludeChannelId)
  );
  const channels = listed.flatMap((chat) =>
    (getUnfurlableChannels(chat) ?? []).map(workspaceChannelChat)
  );
  const searchedAsChannels = new Set(channels.map((chat) => chat.id));
  return [
    ...listed.filter((chat) => !searchedAsChannels.has(chat.id)),
    ...channels,
  ].sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * A line of the panel's list: one of its rows, or the heading a search result
 * gives each half of the list.
 */
export type DrawerListRow =
  | DrawerRow
  | { kind: 'heading'; key: string; label: string }
  /** An empty row for the list to hold still (see the panel's list). */
  | { kind: 'anchor'; key: string };

/**
 * A tab's rows: its pinned section under its own heading, then the rest.
 *
 * The rest is headed too, but only below a pinned section. There it says where
 * the section ends and why the order changes — from the user's arrangement to
 * recency — and with nothing pinned there is no section for it to close.
 *
 * The headings' keys carry the tab. The list holds its first visible row in
 * place across a change of data, and a heading the other tab also has would
 * be found there and held, opening that tab partway down.
 */
export function getDrawerTabRows(
  chats: DrawerTabChats,
  unfurledGroupId: string | null,
  filter: DrawerFilter,
  availableChannels: db.Channel[] = []
): DrawerListRow[] {
  const unpinned = getDrawerRows(
    chats.unpinned,
    unfurledGroupId,
    false,
    availableChannels
  );
  if (!chats.pinned.length) {
    return unpinned;
  }
  return [
    { kind: 'heading', key: `heading:pinned:${filter}`, label: 'Pinned' },
    ...getDrawerRows(chats.pinned, unfurledGroupId, true, availableChannels),
    ...(unpinned.length
      ? [
          {
            kind: 'heading',
            key: `heading:recent:${filter}`,
            label: 'Recent',
          } as const,
          ...unpinned,
        ]
      : []),
  ];
}

/**
 * A search's results, cut back into the two halves the tabs would have shown
 * them in and headed with those tabs' names.
 *
 * The tabs are hidden, but the difference they draw is not gone: a workspace
 * and a direct message are still different enough kinds of destination that
 * a list mixing them reads as a pile. So each half keeps the order the search
 * ranked it in, under its own heading, and a half with nothing in it has no
 * heading either.
 *
 * `searched` is what the search looked through, where the workspace of a
 * channel that matched is found when the workspace itself did not.
 */
export function getDrawerSearchRows(
  results: db.Chat[],
  searched: db.Chat[],
  unfurledGroupId: string | null,
  availableChannels: db.Channel[] = []
): DrawerListRow[] {
  const workspaces = new Map(
    searched
      .filter((chat) => chat.type === 'group')
      .map((chat) => [chat.id, chat])
  );
  return DRAWER_FILTERS.flatMap((filter): DrawerListRow[] => {
    const matches = results.filter((chat) =>
      chatMatchesDrawerFilter(chat, filter)
    );
    if (!matches.length) {
      return [];
    }
    return [
      {
        kind: 'heading',
        key: `heading:${filter}`,
        label: DRAWER_FILTER_LABELS[filter],
      },
      ...getDrawerResultRows(
        matches,
        workspaces,
        unfurledGroupId,
        availableChannels
      ),
    ];
  });
}

/**
 * A half's results as rows, with each channel that matched gathered under its
 * workspace.
 *
 * A channel on its own says little: a dozen workspaces have a "General". So
 * its workspace is listed above it, once, where its best match ranked —
 * whether that was its own name or one of its channels' — and the channels of
 * it that matched follow in the order they ranked. Pressed, the workspace
 * unfurls as it does anywhere else, to every channel it has.
 */
function getDrawerResultRows(
  results: db.Chat[],
  workspaces: ReadonlyMap<string, db.Chat>,
  unfurledGroupId: string | null,
  availableChannels: db.Channel[]
): DrawerRow[] {
  const found = new Map<string, { chat: db.Chat; channels: db.Channel[] }>();
  for (const chat of results) {
    const workspace =
      chat.type === 'channel' && chat.channel.groupId != null
        ? workspaces.get(chat.channel.groupId)
        : undefined;
    const listed = workspace ?? chat;
    const entry = found.get(listed.id) ?? { chat: listed, channels: [] };
    found.set(listed.id, entry);
    if (workspace && chat.type === 'channel') {
      entry.channels.push(chat.channel);
    }
  }
  return [...found.values()].flatMap(({ chat, channels }) =>
    channels.length && chat.id !== unfurledGroupId
      ? getDrawerMatchRows(chat, channels)
      : getDrawerRows([chat], unfurledGroupId, false, availableChannels)
  );
}
