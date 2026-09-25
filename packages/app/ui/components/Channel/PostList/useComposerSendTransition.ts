import type { LegendListRef } from '@legendapp/list/react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Keep composer contraction and the new-message scroll from moving the list
 * in opposite directions. Publish the final inset before scrolling once. */
export function useComposerSendTransition(
  listRef: React.RefObject<LegendListRef | null>,
  applyHeight: (height: number) => void,
  enabled: boolean,
  animated: boolean,
  scrollsToEnd = true
) {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const committingInset = useRef(false);
  const following = useRef(false);
  const latestHeight = useRef<number | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);

  const cancelFrame = useCallback(() => {
    if (frame.current !== undefined) {
      cancelAnimationFrame(frame.current);
      frame.current = undefined;
    }
  }, []);

  useEffect(() => cancelFrame, [cancelFrame]);

  const reportHeight = useCallback(
    (height: number) => {
      latestHeight.current = height;
      if (!activeRef.current || committingInset.current) {
        applyHeight(height);
      }
    },
    [applyHeight]
  );

  const begin = useCallback(() => {
    if (!enabled || !listRef.current?.getState().isNearEnd) {
      return;
    }
    cancelFrame();
    following.current = true;
    committingInset.current = false;
    activeRef.current = true;
    setActive(true);
  }, [cancelFrame, enabled, listRef]);

  const finish = useCallback(() => {
    if (!activeRef.current || frame.current !== undefined) {
      return;
    }
    // Let the final composer onLayout arrive, then commit its inset while
    // keyboard lifting and automatic end scrolling are still suspended.
    frame.current = requestAnimationFrame(() => {
      committingInset.current = true;
      if (latestHeight.current !== undefined) {
        applyHeight(latestHeight.current);
      }
      frame.current = requestAnimationFrame(() => {
        frame.current = undefined;
        activeRef.current = false;
        committingInset.current = false;
        setActive(false);
        if (following.current && scrollsToEnd) {
          void listRef.current?.scrollToEnd({ animated }).catch(() => {
            // Navigation can unmount the list before the scroll completes.
          });
        }
      });
    });
  }, [animated, applyHeight, listRef, scrollsToEnd]);

  const cancelFollowing = useCallback(() => {
    following.current = false;
  }, []);
  const isActive = useCallback(() => activeRef.current, []);

  return { active, isActive, begin, finish, reportHeight, cancelFollowing };
}
