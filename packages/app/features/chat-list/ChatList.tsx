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
}: {
  data: SectionedChatData;
  onPressItem?: (chat: db.Chat) => void;
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
  const contentContainerStyle = {
    padding: getTokenValue('$l', 'size'),
    paddingBottom: 100, // bottom nav height + some cushion
  };

  const isNarrow = useIsWindowNarrow();
  const sizeRefs = useRef({
    sectionHeader: isNarrow ? 28 : 24.55,
    chatListItem: isNarrow ? 72 : 64,
  });

  // update the sizeRefs when the window size changes
  useEffect(() => {
    sizeRefs.current.sectionHeader = isNarrow ? 28 : 24.55;
    sizeRefs.current.chatListItem = isNarrow ? 72 : 64;
  }, [isNarrow]);

  const handleHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    sizeRefs.current.sectionHeader = e.nativeEvent.layout.height;
  }, []);

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

  const listItemHoverStyle = useMemo(
    () => ({ backgroundColor: '$secondaryBackground' }),
    []
  );

  const renderItem: ListRenderItem<ChatListItemData> = useCallback(
    ({ item }) => {
      if (isSectionHeader(item)) {
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
            hoverStyle={listItemHoverStyle}
            testID={`ChatListItem-${item.channel.title ?? item.channel.id}-${item.pin ? 'pinned' : 'unpinned'}`}
          />
        );
      } else if (item.type === 'group' && !item.isPending) {
        return (
          <InteractableChatListItem
            model={item}
            onPress={onPressItem}
            onLongPress={handleLongPress}
            onLayout={handleItemLayout}
            hoverStyle={listItemHoverStyle}
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
            hoverStyle={listItemHoverStyle}
          />
        );
      }
    },
    [
      handleHeaderLayout,
      onPressItem,
      handleLongPress,
      handleItemLayout,
      listItemHoverStyle,
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
