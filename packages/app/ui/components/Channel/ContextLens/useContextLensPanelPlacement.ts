import {
  DESKTOP_SIDEBAR_WIDTH,
  DESKTOP_TOPLEVEL_SIDEBAR_WIDTH,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useWindowDimensions } from 'tamagui';

import {
  estimateDesktopConversationWidth,
  shouldOverlayContextLens,
} from './contextLensPanelPlacement';

const DESKTOP_NAVIGATION_WIDTH =
  DESKTOP_TOPLEVEL_SIDEBAR_WIDTH + DESKTOP_SIDEBAR_WIDTH;

export function useContextLensPanelPlacement() {
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState<number | null>(() =>
    windowWidth > 0
      ? estimateDesktopConversationWidth(windowWidth, DESKTOP_NAVIGATION_WIDTH)
      : null
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setContainerWidth((currentWidth) =>
      currentWidth === nextWidth ? currentWidth : nextWidth
    );
  }, []);

  return {
    onLayout,
    overlay: shouldOverlayContextLens(containerWidth),
  };
}
