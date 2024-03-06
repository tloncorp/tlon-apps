import { useMemo } from 'react';

import { useChatInputFocus } from './ChatInputFocusContext';
import { useSafeAreaInsets } from './native';
import useShowTabBar from './useShowTabBar';

export const BOTTOM_WEB_NAV_OFFSET = 50;

export function useBottomPadding() {
  const safeAreaInsets = useSafeAreaInsets();
  const { isChatInputFocused } = useChatInputFocus();
  const showTabBar = useShowTabBar();
  const shouldApplyBottomPadding = useMemo(
    () => showTabBar && !isChatInputFocused,
    [showTabBar, isChatInputFocused]
  );

  return {
    shouldApplyBottomPadding,
    paddingBottom: shouldApplyBottomPadding
      ? safeAreaInsets.bottom + BOTTOM_WEB_NAV_OFFSET
      : 0,
  };
}
