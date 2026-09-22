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
  isSending: () => boolean
) {
  const { floating, setFloating } = useConversationComposerLayout();
  const previousPosition = useRef<ScrollPosition | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !ready) {
      return;
    }
    const state = listRef.current?.getState();
    if (state) {
      setFloating(
        getFloatingComposerMode(
          state.contentLength - state.scrollLength - state.scroll,
          false
        )
      );
    }
    return () => setFloating(false);
  }, [enabled, ready, listRef, setFloating]);

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
        return;
      }
      const distance =
        Math.max(0, position.contentHeight - position.viewportHeight) -
        position.offset;
      const next = getFloatingComposerMode(distance, floating);
      if (next !== floating) {
        setFloating(next);
      }
    },
    [enabled, ready, isSending, floating, setFloating]
  );
}
