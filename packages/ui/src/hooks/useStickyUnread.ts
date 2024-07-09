import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

type AnyUnread = db.ChannelUnread | db.ThreadUnreadState;
type UnreadInput = AnyUnread | null | undefined;

// Once the channel is mounted, we want to preserve the initial unread state /
// banner unless cleared explicitly (which functionality doesn't yet exist).
export function useStickyUnread<T extends UnreadInput>(unread: T): T {
  return useMemo(
    () => {
      return unread;
    },
    // we don't want this to change unless we're actually navigating to a
    // different channel
    // eslint-disable-next-line
    [unread?.channelId]
  );
}
