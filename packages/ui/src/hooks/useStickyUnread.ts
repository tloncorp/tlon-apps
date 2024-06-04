import * as db from '@tloncorp/shared/dist/db';
import { useEffect, useRef, useState } from 'react';

const READ_DELAY = 15_000; // 15 seconds

type AnyUnread = db.Unread | db.ThreadUnreadState;
type UnreadInput = AnyUnread | null | undefined;

// If we read a channel, we want the divider to stay visible for a bit before clearing. This hook
// can be used to delay marking a channel as read in the UI
export function useStickyUnread<T extends UnreadInput>(unread: T): T {
  const readTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [unreadState, setUnreadState] = useState<T>(unread);

  useEffect(() => {
    const wasRead = wasNewlyRead(unread, unreadState);

    if (wasRead && !readTimeout.current) {
      readTimeout.current = setTimeout(() => {
        setUnreadState(unread);
        readTimeout.current = null;
      }, READ_DELAY);
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

function isChannelUnread(unread: AnyUnread): unread is db.Unread {
  return 'countWithoutThreads' in unread;
}
