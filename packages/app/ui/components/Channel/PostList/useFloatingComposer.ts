import type { LegendListRef } from '@legendapp/list/react-native';
import { useCallback, useEffect, useRef } from 'react';

import { useConversationComposerLayout } from '../ConversationLayout';

type ScrollPosition = {
  offset: number;
  contentHeight: number;
  viewportHeight: number;
};

/** Keep a small dead zone so rounding and bottom bounce cannot toggle chrome. */
export function getFloatingComposerMode(distance: number, floating: boolean) {
  return floating ? distance > 2 : distance > 24;
}

export function useFloatingComposer(
  listRef: React.RefObject<LegendListRef | null>,
  enabled: boolean,
  ready: boolean,
  isSending: () => boolean,
  isBrowsingHistory: () => boolean,
  hasNewerPosts: boolean
) {
  const { floating, setFloating } = useConversationComposerLayout();
  const floatingRef = useRef(floating);
  floatingRef.current = floating;
  const previousPosition = useRef<ScrollPosition | undefined>(undefined);
  const settleFrame = useRef<number | undefined>(undefined);
  const cancelSettlement = useCallback(() => {
    if (settleFrame.current !== undefined) {
      cancelAnimationFrame(settleFrame.current);
      settleFrame.current = undefined;
    }
  }, []);
  useEffect(() => cancelSettlement, [cancelSettlement, hasNewerPosts]);
  const settleDocking = useCallback(() => {
    cancelSettlement();
    settleFrame.current = requestAnimationFrame(() => {
      settleFrame.current = requestAnimationFrame(() => {
        settleFrame.current = undefined;
        const state = listRef.current?.getState();
        if (
          state &&
          !hasNewerPosts &&
          state.contentLength - state.scrollLength - state.scroll <= 2
        ) {
          setFloating(false);
        }
      });
    });
  }, [cancelSettlement, listRef, hasNewerPosts, setFloating]);

  useEffect(() => {
    if (!enabled || !ready) {
      return;
    }
    const state = listRef.current?.getState();
    if (state) {
      setFloating(
        hasNewerPosts ||
          getFloatingComposerMode(
            state.contentLength - state.scrollLength - state.scroll,
            floatingRef.current
          )
      );
    }
    return () => setFloating(false);
  }, [enabled, ready, hasNewerPosts, listRef, setFloating]);

  return useCallback(
    (position: ScrollPosition) => {
      const previous = previousPosition.current;
      previousPosition.current = position;
      if (!enabled || !ready || isSending()) {
        return;
      }
      // Mode changes exchange inline composer space for an equal list footer.
      // Native can report those two measurements separately. Keyboard and row
      // resizes also produce scroll events; wait for scrolling in settled bounds.
      if (
        previous &&
        (Math.abs(previous.viewportHeight - position.viewportHeight) > 1 ||
          Math.abs(previous.contentHeight - position.contentHeight) > 1)
      ) {
        // A keyboard dismissal or draft contraction can reach the end without
        // another scroll event. Recheck after the footer and viewport settle.
        if (floating) {
          settleDocking();
        }
        return;
      }
      const distance =
        Math.max(0, position.contentHeight - position.viewportHeight) -
        position.offset;
      const next = hasNewerPosts || getFloatingComposerMode(distance, floating);
      // Programmatic end following can temporarily lag a new row or a
      // contracting draft. Only deliberate backward navigation enters overlay.
      if (
        next &&
        !floating &&
        (!isBrowsingHistory() ||
          !previous ||
          position.offset >= previous.offset)
      ) {
        return;
      }
      if (next !== floating) {
        setFloating(next);
      }
    },
    [
      enabled,
      ready,
      isSending,
      isBrowsingHistory,
      floating,
      hasNewerPosts,
      setFloating,
      settleDocking,
    ]
  );
}
