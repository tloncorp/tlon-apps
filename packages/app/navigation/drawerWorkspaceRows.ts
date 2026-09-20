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
    }
  | {
      kind: 'channel';
      key: string;
      channel: db.Channel;
      groupId: string;
      /**
       * Muted at the workspace, which is the whole block's answer: the user
       * asked not to be drawn back to any of this, and the workspace row above
       * is already keeping its own dot off.
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
 * Three kinds of row do not. A direct message is not a workspace. An invite is
 * acted on through its preview sheet, and its channels are not the user's to
 * open until they have joined. And a workspace holding one readable channel is
 * already opened *as* that channel — there is nothing to choose between, so
 * unfurling it would put the same conversation on two rows and ask the user
 * which.
 */
export function unfurls(chat: db.Chat): boolean {
  if (chat.type !== 'group' || chat.isPending) {
    return false;
  }
  return readableChannels(chat.group).length > 1;
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
 * Whether a channel's row lights its unread dot.
 *
 * The same contract the chat rows keep: a chat the user asked not to be drawn
 * back to keeps its count on the workspace list, where counts are read
 * deliberately, and lights nothing in the panel. Muting the workspace answers
 * for every channel in it, which is what muting a workspace means.
 */
export function channelRowHasUnread(
  channel: db.Channel,
  groupMuted: boolean
): boolean {
  const notified = channel.unread?.notify ?? false;
  if ((channel.unread?.count ?? 0) <= 0 && !notified) {
    return false;
  }
  return (
    !groupMuted && !logic.isMuted(channel.volumeSettings?.level, 'channel')
  );
}

/**
 * The drawer's chats, with the channels of every unfurled workspace laid out
 * beneath it.
 *
 * A channel's key is qualified by its workspace rather than being the channel's
 * own id, because a channel pinned out of a group is already a chat row of this
 * list under exactly that id — two rows for the one channel, which is intended,
 * and two rows the virtualiser must be able to tell apart.
 */
export function getDrawerRows(
  chats: db.Chat[],
  unfurledGroupIds: ReadonlySet<string>
): DrawerRow[] {
  const rows: DrawerRow[] = [];
  for (const chat of chats) {
    // Asked of every row on every chat-list change, so it stays a count. Only
    // a row that is actually open pays to copy and order its channels.
    const rowUnfurls = unfurls(chat);
    const unfurled = rowUnfurls && unfurledGroupIds.has(chat.id);
    rows.push({
      kind: 'chat',
      key: chat.id,
      chat,
      unfurls: rowUnfurls,
      unfurled,
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
 * The set with this workspace's state flipped.
 *
 * Several may be open at once. Closing whichever was open to open another is
 * the other reading of "accordion", and it takes something away the user did
 * not ask to have taken: two workspaces they are moving between is the case the
 * panel is worth opening for.
 */
export function toggleUnfurled(
  unfurledGroupIds: ReadonlySet<string>,
  groupId: string
): ReadonlySet<string> {
  const next = new Set(unfurledGroupIds);
  if (!next.delete(groupId)) {
    next.add(groupId);
  }
  return next;
}
