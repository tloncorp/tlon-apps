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
 * Coming back to a channel whose list has been on screen (from a thread, an
 * image, a search, another tab) keeps the snapshot it was opened with. The
 * channel was marked read while it was on screen, so a fresh read finds no
 * unreads, or finds the ones that arrived while the reader was away; taking
 * either would change the unread anchor and the list's mount key, and rebuild
 * the list behind a spinner, away from where the reader left it.
 *
 * A fresh snapshot is taken for another channel, and, until the list has been
 * shown, when one opened with nothing unread now has unreads.
 */
export function nextChannelUnreadSnapshot(
  previous: ChannelUnreadSnapshot | null,
  fresh: ChannelUnreadSnapshot,
  { listShown }: { listShown: boolean }
): ChannelUnreadSnapshot {
  if (
    previous?.channelId === fresh.channelId &&
    (listShown || hasUnreads(previous.unread) || !hasUnreads(fresh.unread))
  ) {
    return previous;
  }
  return fresh;
}
