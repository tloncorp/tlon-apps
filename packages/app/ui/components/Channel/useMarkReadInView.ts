import { useEffect, useRef } from 'react';

// Lets high priority tasks reach the sync queue before the read.
const MARK_READ_DELAY_MS = 150;

/**
 * Marks a channel read a moment after its unread posts are on screen.
 *
 * A reader who leaves before that moment has still seen them, so the read
 * scheduled for them is sent as they go rather than dropped. `stamp`
 * identifies the unread being read: a failed read rolls the unread back
 * unchanged, and the same unread is not tried again until there is new
 * activity.
 */
export function useMarkReadInView({
  canMarkRead,
  inView,
  stamp,
  markRead,
}: {
  /** Unread posts are loaded and on screen, and the reader is active. */
  canMarkRead: boolean;
  inView: boolean;
  stamp: string | null;
  markRead: () => void;
}) {
  const lastAttemptRef = useRef<string | null>(null);
  // the read scheduled but not yet sent, if any
  const pendingRef = useRef<{ stamp: string | null } | null>(null);
  const markReadRef = useRef(markRead);
  useEffect(() => {
    markReadRef.current = markRead;
  }, [markRead]);

  useEffect(() => {
    const send = (attempt: string | null) => {
      pendingRef.current = null;
      lastAttemptRef.current = attempt;
      markReadRef.current();
    };
    if (canMarkRead) {
      if (stamp === lastAttemptRef.current) {
        pendingRef.current = null;
        return;
      }
      pendingRef.current = { stamp };
      const timeout = setTimeout(() => send(stamp), MARK_READ_DELAY_MS);
      // The pending read outlives this timer so leaving can still send it.
      return () => clearTimeout(timeout);
    }
    if (!inView && pendingRef.current !== null) {
      send(pendingRef.current.stamp);
    } else {
      pendingRef.current = null;
    }
  }, [canMarkRead, inView, stamp]);

  useEffect(
    () => () => {
      if (pendingRef.current !== null) {
        lastAttemptRef.current = pendingRef.current.stamp;
        pendingRef.current = null;
        markReadRef.current();
      }
    },
    []
  );
}
