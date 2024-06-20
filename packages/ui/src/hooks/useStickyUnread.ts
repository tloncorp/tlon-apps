import * as db from '@tloncorp/shared/dist/db';
import { useEffect, useRef, useState } from 'react';

const READ_DELAY = 15_000; // 15 seconds

type AnyUnread = db.ChannelUnread | db.ThreadUnreadState;
type UnreadInput = AnyUnread | null | undefined;

// If we read a channel, we want the divider to stay visible for a bit before clearing. This hook
// can be used to delay marking a channel as read in the UI
export function useStickyUnread<T extends UnreadInput>(unread: T): T {
  const readTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [unreadState, setUnreadState] = useState<T>(unread);

  useEffect(() => {
    const wasRead = wasNewlyRead(unread, unreadState);
    // if it was read, we need to clear it on a delay if not already waiting
    if (wasRead) {
      if (!readTimeout.current) {
        readTimeout.current = setTimeout(() => {
          setUnreadState(unread);
          readTimeout.current = null;
        }, READ_DELAY);
      }
      // and always return early to avoid setting the state prematurely
      return;
    }

    setUnreadState(unread);
  }, [unread, unreadState]);

  return unreadState;
}

function wasNewlyRead(current: UnreadInput, previous: UnreadInput): boolean {
  if (!current || !previous) {
    return false;
  }

  if (isChannelUnread(current) && isChannelUnread(previous)) {
    const countWasRead = current?.count === 0 && (previous?.count ?? 0) > 0;
    const countWithoutThreadsWasRead =
      current?.countWithoutThreads === 0 &&
      (previous?.countWithoutThreads ?? 0) > 0;
    return countWasRead || countWithoutThreadsWasRead;
  }

  return current.count === 0 && (previous.count ?? 0) > 0;
}

function isChannelUnread(unread: AnyUnread): unread is db.ChannelUnread {
  return 'countWithoutThreads' in unread;
}
