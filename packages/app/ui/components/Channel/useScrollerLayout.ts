import { type PostCollectionLayoutType, layoutForType } from '@tloncorp/shared';
import {
  DESKTOP_SIDEBAR_WIDTH,
  DESKTOP_TOPLEVEL_SIDEBAR_WIDTH,
} from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  Platform,
  type StyleProp,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokens, useStyle } from 'tamagui';

import type { ConversationContentInsets } from './PostList';

/** Keeps viewport, grid, composer and safe-area geometry in one place. */
export function useScrollerLayout({
  collectionLayoutType,
  collectionLayout,
  visiblePostCount,
  contentInsets,
  isWindowNarrow,
}: {
  collectionLayoutType: PostCollectionLayoutType;
  collectionLayout: ReturnType<typeof layoutForType>;
  visiblePostCount: number;
  contentInsets: ConversationContentInsets;
  isWindowNarrow: boolean;
}) {
  const { width } = useWindowDimensions();
  const availableSpace = useMemo(() => {
    const sidebarsTotalWidth = isWindowNarrow
      ? 0
      : DESKTOP_TOPLEVEL_SIDEBAR_WIDTH + DESKTOP_SIDEBAR_WIDTH;
    return Math.floor(width - sidebarsTotalWidth - 2 * getTokens().space.m.val);
  }, [width, isWindowNarrow]);

  const columns = useMemo(() => {
    const gap = getTokens().space.l.val;
    return collectionLayout.columnCount === 1
      ? 1
      : Math.max(2, Math.floor((availableSpace + gap) / (250 + gap)));
  }, [availableSpace, collectionLayout.columnCount]);

  const itemWidth = useMemo(() => {
    const totalGap = (columns - 1) * getTokens().space.l.val;
    return Math.floor((availableSpace - totalGap) / columns);
  }, [availableSpace, columns]);

  const insets = useSafeAreaInsets();
  const rootVerticalPadding = getTokens().space.l.val;
  const composerBottomInset = contentInsets.bottom;
  // iOS conversation lists keep the composer inset native so the list can
  // own keyboard and composer clearance; every other layout pads for it.
  const listOwnsComposerInset =
    Platform.OS === 'ios' &&
    collectionLayoutType === 'compact-list-bottom-to-top';
  const scrollContentBottomInset = listOwnsComposerInset
    ? 0
    : contentInsets.bottom;
  const [listFrameHeight, setListFrameHeight] = useState<number | null>(null);
  const handleListFrameLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setListFrameHeight((current) => (current === height ? current : height));
  }, []);
  const standaloneBottomSafeArea = composerBottomInset > 0 ? 0 : insets.bottom;
  const scrollButtonBottom =
    composerBottomInset > 0
      ? composerBottomInset + getTokens().space.s.val
      : getTokens().space.m.val;
  const contentContainerStyle = useStyle(
    useMemo(() => {
      if (!visiblePostCount) {
        if (
          collectionLayoutType === 'comfy-list-top-to-bottom' ||
          collectionLayoutType === 'grid'
        ) {
          return {
            flexGrow: 1,
            paddingTop: rootVerticalPadding + contentInsets.top,
            paddingBottom:
              standaloneBottomSafeArea +
              rootVerticalPadding +
              scrollContentBottomInset,
          };
        }
        // LegendList end-aligns rows within the area above the native composer
        // inset, but only once it has rows. With none it falls back to a
        // viewport-sized container whose footer (the thinking indicator)
        // lands wherever the scroll offset happens to be. Give the empty
        // conversation that same above-the-composer height so the footer
        // rests in place at offset 0 with no scroll range to drift into.
        if (listOwnsComposerInset && listFrameHeight != null) {
          return {
            minHeight: Math.max(0, listFrameHeight - contentInsets.bottom),
            paddingTop: contentInsets.top,
          };
        }
        return {
          flexGrow: 1,
          paddingTop: contentInsets.top,
          paddingBottom: scrollContentBottomInset,
        };
      }

      switch (collectionLayoutType) {
        case 'compact-list-bottom-to-top': {
          return {
            paddingHorizontal: '$m',
            paddingTop: contentInsets.top,
            paddingBottom: scrollContentBottomInset,
          };
        }

        case 'comfy-list-top-to-bottom': {
          return {
            paddingHorizontal: '$m',
            gap: '$l',
            paddingTop: rootVerticalPadding + contentInsets.top,
            paddingBottom:
              standaloneBottomSafeArea +
              rootVerticalPadding +
              scrollContentBottomInset,
          };
        }

        case 'grid': {
          return {
            paddingHorizontal: '$m',
            gap: '$l',
            paddingTop: rootVerticalPadding + contentInsets.top,
            paddingBottom:
              standaloneBottomSafeArea +
              rootVerticalPadding +
              scrollContentBottomInset,
          };
        }
      }
    }, [
      standaloneBottomSafeArea,
      visiblePostCount,
      collectionLayoutType,
      contentInsets.bottom,
      contentInsets.top,
      listFrameHeight,
      listOwnsComposerInset,
      rootVerticalPadding,
      scrollContentBottomInset,
    ])
  ) as StyleProp<ViewStyle>;

  const columnWrapperStyle = useStyle(
    collectionLayout.columnCount === 1
      ? {}
      : {
          gap: '$l',
          width: '100%',
        }
  ) as StyleProp<ViewStyle>;

  return {
    columns,
    itemWidth,
    contentContainerStyle,
    columnWrapperStyle,
    composerBottomInset,
    scrollButtonBottom,
    listOwnsComposerInset,
    handleListFrameLayout,
  };
}
