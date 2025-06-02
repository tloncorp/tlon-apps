import { FlashList, ListRenderItem } from '@shopify/flash-list';
import * as db from '@tloncorp/shared/db';
import { isEqual } from 'lodash';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { LayoutChangeEvent } from 'react-native';
import { getTokenValue } from 'tamagui';

import { SectionedChatData } from '../../hooks/useFilteredChats';
import { useRenderCount } from '../../hooks/useRenderCount';
import {
  ChatListItem,
  InteractableChatListItem,
  SectionListHeader,
  useChatOptions,
  useIsWindowNarrow,
} from '../../ui';

type SectionHeaderData = { type: 'sectionHeader'; title: string };
export type ChatListItemData = db.Chat | SectionHeaderData;

export const ChatList = React.memo(function ChatListComponent({
  data,
  onPressItem,
  compact = false,
}: {
  data: SectionedChatData;
  onPressItem?: (chat: db.Chat) => void;
  compact?: boolean;
}) {
  const listItems: ChatListItemData[] = useMemo(
    () =>
      data.flatMap((section) => {
        return [
          { title: section.title, type: 'sectionHeader' },
          ...section.data,
        ];
      }),
    [data]
  );

  const { open } = useChatOptions();
  const handleLongPress = useCallback(
    (item: db.Chat) => {
      if (!item.isPending) {
        open(item.id, item.type);
      }
    },
    [open]
  );

  // removed the use of useStyle here because it was causing FlashList to
  // peg the CPU and freeze the app on web
  // see: https://github.com/Shopify/flash-list/pull/852
  const contentContainerStyle = compact
    ? {
        paddingVertical: getTokenValue('$l', 'size'),
        paddingHorizontal: getTokenValue('$m', 'size'),
        gap: getTokenValue('$m', 'size'),
      }
    : {
        padding: getTokenValue('$l', 'size'),
        paddingBottom: 100, // bottom nav height + some cushion
      };

  const isNarrow = useIsWindowNarrow();
  const sizeRefs = useRef({
    sectionHeader: compact ? 0 : isNarrow ? 28 : 24.55,
    chatListItem: compact ? 56 : isNarrow ? 72 : 64,
  });

  // update the sizeRefs when the window size changes
  useEffect(() => {
    if (compact) {
      sizeRefs.current.sectionHeader = 0;
      sizeRefs.current.chatListItem = 56;
    } else {
      sizeRefs.current.sectionHeader = isNarrow ? 28 : 24.55;
      sizeRefs.current.chatListItem = isNarrow ? 72 : 64;
    }
  }, [isNarrow, compact]);

  const handleHeaderLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (!compact) {
        sizeRefs.current.sectionHeader = e.nativeEvent.layout.height;
      }
    },
    [compact]
  );

  const handleItemLayout = useCallback((e: LayoutChangeEvent) => {
    sizeRefs.current.chatListItem = e.nativeEvent.layout.height;
  }, []);

  const handleOverrideLayout = useCallback(
    (layout: { span?: number; size?: number }, item: ChatListItemData) => {
      layout.size = isSectionHeader(item)
        ? sizeRefs.current.sectionHeader
        : sizeRefs.current.chatListItem;
    },
    []
  );

  const renderItem: ListRenderItem<ChatListItemData> = useCallback(
    ({ item }) => {
      if (isSectionHeader(item)) {
        // // Don't render section headers in compact mode
        // if (compact) return null;

        return (
          <SectionListHeader onLayout={handleHeaderLayout}>
            <SectionListHeader.Text>{item.title}</SectionListHeader.Text>
          </SectionListHeader>
        );
      } else if (item.type === 'channel' && !item.isPending) {
        return (
          <InteractableChatListItem
            model={item}
            onPress={onPressItem}
            onLongPress={handleLongPress}
            onLayout={handleItemLayout}
            hoverStyle={{ backgroundColor: '$secondaryBackground' }}
            compact={compact}
          />
        );
      } else if (item.type === 'group' && !item.isPending) {
        return (
          <InteractableChatListItem
            model={item}
            onPress={onPressItem}
            onLongPress={handleLongPress}
            onLayout={handleItemLayout}
            hoverStyle={{ backgroundColor: '$secondaryBackground' }}
            compact={compact}
          />
        );
      } else {
        return (
          <ChatListItem
            model={item}
            onPress={onPressItem}
            onLongPress={handleLongPress}
            onLayout={handleItemLayout}
            disableOptions={item.isPending}
            hoverStyle={{ backgroundColor: '$secondaryBackground' }}
            compact={compact}
          />
        );
      }
    },
    [
      handleHeaderLayout,
      onPressItem,
      handleLongPress,
      handleItemLayout,
      compact,
    ]
  );

  useRenderCount('ChatList');

  return (
    <FlashList
      data={listItems}
      contentContainerStyle={contentContainerStyle}
      keyExtractor={getChatKey}
      renderItem={renderItem}
      getItemType={getItemType}
      estimatedItemSize={sizeRefs.current.chatListItem}
      overrideItemLayout={handleOverrideLayout}
    />
  );
}, isEqual);

export function getItemType(item: ChatListItemData) {
  return isSectionHeader(item) ? 'sectionHeader' : item.type;
}

export function isSectionHeader(
  data: ChatListItemData
): data is SectionHeaderData {
  return 'type' in data && data.type === 'sectionHeader';
}

export function getChatKey(chatItem: ChatListItemData) {
  if (!chatItem || typeof chatItem !== 'object') {
    return 'invalid-item';
  }

  if (isSectionHeader(chatItem)) {
    return chatItem.title;
  }

  return `${chatItem.id}-${chatItem.pin?.itemId ?? ''}`;
}
