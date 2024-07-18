import { ActivitySummary } from 'packages/shared/dist/urbit';
import { useEffect, useRef, useState } from 'react';

const READ_DELAY = 15_000; // 15 seconds
export function useStickyUnread(summary: ActivitySummary): ActivitySummary {
  const readTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [unreadState, setUnreadState] = useState(summary);

  useEffect(() => {
    const wasRead = wasNewlyRead(summary, unreadState);
    // if it was read, we need to clear it on a delay if not already waiting
    if (wasRead) {
      if (!readTimeout.current) {
        readTimeout.current = setTimeout(() => {
          setUnreadState(summary);
          readTimeout.current = null;
        }, READ_DELAY);
      }
      // and always return early to avoid setting the state prematurely
      return;
    }

    setUnreadState(summary);
  }, [summary, unreadState]);

  return unreadState;
}

function wasNewlyRead(
  current: ActivitySummary,
  previous: ActivitySummary
): boolean {
  return current.count === 0 && (previous.count ?? 0) > 0;
}
