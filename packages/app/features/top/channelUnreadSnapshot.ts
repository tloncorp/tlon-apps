import type * as db from '@tloncorp/shared/db';

export type ChannelUnreadSnapshot = {
  channelId: string;
  unread: db.ChannelUnread | null;
};

function hasUnreads(unread: db.ChannelUnread | null) {
  return (unread?.countWithoutThreads ?? 0) > 0;
}

/**
 * The snapshot to open a channel with when it gains focus.
 *
 * Coming back to a channel that is already open (from a thread, an image, a
 * search) keeps the snapshot it was opened with. The channel was marked read
 * while it was on screen, so a fresh read finds no unreads; taking it would
 * drop the unread anchor, change the list's mount key and rebuild the list at
 * its end, away from where the reader was. A fresh snapshot is only taken for
 * another channel, or when one opened with nothing unread now has unreads, so
 * a channel that stays open as a tab still lands on what arrived while away.
 */
export function nextChannelUnreadSnapshot(
  previous: ChannelUnreadSnapshot | null,
  fresh: ChannelUnreadSnapshot
): ChannelUnreadSnapshot {
  if (
    previous?.channelId === fresh.channelId &&
    (hasUnreads(previous.unread) || !hasUnreads(fresh.unread))
  ) {
    return previous;
  }
  return fresh;
}
