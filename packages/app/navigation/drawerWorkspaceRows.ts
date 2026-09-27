import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';

/**
 * One line of the drawer's list.
 *
 * The list is flat — a chat, or a channel of a workspace unfurled beneath it —
 * rather than a workspace cell that draws its own channels inside itself. Both
 * shapes give the same picture, but only this one keeps every row a row of the
 * list: the virtualiser mounts what is on screen, and an unfurled workspace of
 * forty channels stays forty rows it can leave unmounted instead of one cell it
 * must build whole.
 */
export type DrawerRow =
  | {
      kind: 'chat';
      key: string;
      chat: db.Chat;
      /** Whether this row unfurls its channels instead of navigating. */
      unfurls: boolean;
      unfurled: boolean;
      /** In the pinned section at the top of its tab. */
      pinned: boolean;
    }
  | {
      kind: 'channel';
      key: string;
      channel: db.Channel;
      groupId: string;
      /**
       * Muted at the workspace, which answers for every channel in it that has
       * not been turned back up on its own: the user asked not to be drawn back
       * to any of this, and the workspace row above is already keeping its own
       * dot off.
       */
      groupMuted: boolean;
      /** Last channel of its workspace, where the block's fill ends. */
      last: boolean;
    };

/**
 * When a channel last saw anything, by the same reckoning the group's own
 * channel list uses: whichever is newer of its last post and its activity
 * summary. A notebook channel never has posts, so the summary is the only
 * thing that speaks for it.
 *
 * The rows are both ordered and timestamped by this, so what a row says and
 * where it sits agree.
 */
export function channelRecency(channel: db.Channel): number {
  return Math.max(channel.lastPostAt ?? 0, channel.unread?.updatedAt ?? 0);
}

/**
 * The channels of a workspace that are this user's to open.
 *
 * The chat list loads every channel row it holds for a group, which is not the
 * same as every channel this user can read: `currentUserIsMember` is set from
 * read permission, so a role-gated channel of a group they are in is in that
 * list with the flag false. `getGroup` filters on exactly this, which is what
 * the workspace's own channel list shows and what `getMainGroupRoute` counts,
 * so the panel has to filter the same way or it will offer a conversation the
 * user cannot open and disagree with the screen behind it about how many a
 * workspace has.
 */
function readableChannels(group: db.Group): db.Channel[] {
  return (group.channels ?? []).filter(
    (channel) => channel.currentUserIsMember === true
  );
}

/**
 * Whether a chat row unfurls rather than navigating.
 *
 * Every workspace does, one of a single channel too: a workspace reads the
 * same in the panel however many channels it has, and pressing one always
 * shows what is inside it rather than sometimes going somewhere instead.
 *
 * Three kinds of row do not. A direct message is not a workspace. An invite is
 * acted on through its preview sheet, and its channels are not the user's to
 * open until they have joined. And a workspace with no channel the user can
 * read yet — its channels unsynced, or every one of them gated — would unfurl
 * to nothing, so it opens the way the workspace list opens it.
 */
export function unfurls(chat: db.Chat): boolean {
  if (chat.type !== 'group' || chat.isPending) {
    return false;
  }
  return readableChannels(chat.group).length > 0;
}

/**
 * The channels a chat row unfurls, newest first, or `null` for a row that does
 * not unfurl.
 */
export function getUnfurlableChannels(chat: db.Chat): db.Channel[] | null {
  if (!unfurls(chat) || chat.type !== 'group') {
    return null;
  }
  return readableChannels(chat.group).sort(
    (a, b) => channelRecency(b) - channelRecency(a)
  );
}

/**
 * Whether a chat has an unread the panel would light a dot for.
 *
 * A reaction, mention or thread reply can leave a chat notified with a count
 * of zero, which the workspace list reads as unread and so does this. A muted
 * chat is one the user asked not to be drawn back to, so it keeps its count on
 * the workspace list — where counts are read deliberately — and lights nothing
 * in the panel.
 *
 * A muted workspace is not simply silent, though. A channel inside it that has
 * been turned back up is one the user asked to keep hearing, and the workspace
 * roll-up this reads cannot say so — it is suppressed whole by the mute. So a
 * muted workspace is asked about the channels it holds, and lights for a
 * channel that speaks over it. Asked whether or not the workspace is unfurled:
 * folded shut, its row is the only place in the panel that can say so.
 *
 * Asked by the row itself and by the tab above it, so what a tab claims its
 * hidden half is holding is what its rows would show.
 */
export function chatRowHasUnread(chat: db.Chat): boolean {
  const notified =
    chat.type === 'group'
      ? (chat.group.unread?.notify ?? false)
      : (chat.channel.unread?.notify ?? false);
  if (!logic.isMuted(chat.volumeSettings?.level, chat.type)) {
    return chat.unreadCount > 0 || notified;
  }
  // An invite's channels are not the user's to hear until they have joined,
  // and a direct message has none to ask about.
  if (chat.type !== 'group' || chat.isPending) {
    return false;
  }
  return readableChannels(chat.group).some(
    (channel) => channelHoldsUnread(channel) && channelIsHeard(channel, true)
  );
}

function channelHoldsUnread(channel: db.Channel): boolean {
  return (channel.unread?.count ?? 0) > 0 || (channel.unread?.notify ?? false);
}

/**
 * Whether the user still hears a channel of a workspace.
 *
 * A channel's own setting is an override rather than something the workspace's
 * is read alongside — `getChannelVolumeSetting` returns it and stops, and only
 * a channel that has none falls back to what encloses it. So a workspace set to
 * `hush` with one channel turned back up is a workspace the user still hears
 * that one channel from.
 */
function channelIsHeard(channel: db.Channel, groupMuted: boolean): boolean {
  const ownLevel = channel.volumeSettings?.level;
  if (ownLevel) {
    return !logic.isMuted(ownLevel, 'channel');
  }
  return !groupMuted;
}

/**
 * What a channel's row says about its unread: nothing, the grey dot, or the
 * accent one.
 *
 * Unlike a chat row, a channel row speaks for a muted channel too. It is only
 * on screen once the user has opened its workspace to look inside, which is
 * reading deliberately — the reason the workspace list keeps a muted chat's
 * count — so it is bold with the grey dot, as an unread that does not alert
 * is. Only a notified unread in a channel the user still hears takes the
 * accent.
 */
export function channelRowUnread(
  channel: db.Channel,
  groupMuted: boolean
): 'none' | 'quiet' | 'notified' {
  if (!channelHoldsUnread(channel)) {
    return 'none';
  }
  return (channel.unread?.notify ?? false) &&
    channelIsHeard(channel, groupMuted)
    ? 'notified'
    : 'quiet';
}

/**
 * The drawer's chats, with the channels of the unfurled workspace laid out
 * beneath it. `pinned` marks each chat row as one of its tab's pinned section.
 *
 * A channel's key is qualified by its workspace rather than being the channel's
 * own id, because a channel pinned out of a group is already a chat row of this
 * list under exactly that id — two rows for the one channel, which is intended,
 * and two rows the virtualiser must be able to tell apart.
 */
export function getDrawerRows(
  chats: db.Chat[],
  unfurledGroupId: string | null,
  pinned = false
): DrawerRow[] {
  const rows: DrawerRow[] = [];
  for (const chat of chats) {
    // Asked of every row on every chat-list change, so it stays a count. Only
    // a row that is actually open pays to copy and order its channels.
    const rowUnfurls = unfurls(chat);
    const unfurled = rowUnfurls && chat.id === unfurledGroupId;
    rows.push({
      kind: 'chat',
      key: chat.id,
      chat,
      unfurls: rowUnfurls,
      unfurled,
      pinned,
    });
    const channels = unfurled ? getUnfurlableChannels(chat) : null;
    if (!channels) {
      continue;
    }
    const groupMuted =
      chat.type === 'group' &&
      logic.isMuted(chat.volumeSettings?.level, 'group');
    channels.forEach((channel, index) => {
      rows.push({
        kind: 'channel',
        key: `${chat.id}:${channel.id}`,
        channel,
        groupId: chat.id,
        groupMuted,
        last: index === channels.length - 1,
      });
    });
  }
  return rows;
}

/**
 * Which workspace is open after this one is pressed.
 *
 * One at a time: opening a workspace closes whichever was open. The panel is a
 * list of every conversation the user has, and an accordion that let them all
 * stand open would push that list off the bottom of the screen a workspace at
 * a time. Carried as the one id rather than a set of them so that two open at
 * once is not a state this can reach.
 */
export function toggleUnfurled(
  unfurledGroupId: string | null,
  groupId: string
): string | null {
  return unfurledGroupId === groupId ? null : groupId;
}
