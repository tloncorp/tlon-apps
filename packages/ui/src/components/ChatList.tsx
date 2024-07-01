import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useMemo, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionList,
  SectionListData,
  SectionListRenderItemInfo,
  StyleProp,
  ViewStyle,
  ViewToken,
} from 'react-native';

import { useStyle } from '../core';
import { ChatListItem, SwipableChatListItem } from './ListItem';
import { SectionListHeader } from './SectionList';

export type Chat = db.Channel | db.Group;

export function ChatList({
  pinned,
  unpinned,
  pendingChats,
  onLongPressItem,
  onPressItem,
  onSectionChange,
}: store.CurrentChats & {
  onPressItem?: (chat: Chat) => void;
  onLongPressItem?: (chat: Chat) => void;
  onSectionChange?: (title: string) => void;
}) {
  const data = useMemo(() => {
    if (pinned.length === 0) {
      return [{ title: 'All', data: [...pendingChats, ...unpinned] }];
    }

    return [
      { title: 'Pinned', data: pinned },
      { title: 'All', data: [...pendingChats, ...unpinned] },
    ];
  }, [pinned, unpinned, pendingChats]);

  const contentContainerStyle = useStyle(
    {
      gap: '$s',
      paddingHorizontal: '$l',
    },
    { resolveValues: 'value' }
  ) as StyleProp<ViewStyle>;

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<Chat, { title: string }>) => {
      const baseListItem = (
        <ChatListItem
          model={item}
          onPress={onPressItem}
          onLongPress={onLongPressItem}
        />
      );
      return logic.isChannel(item) ? (
        <SwipableChatListItem model={item}>{baseListItem}</SwipableChatListItem>
      ) : (
        baseListItem
      );
    },
    [onPressItem, onLongPressItem]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<Chat, { title: string }> }) => {
      return (
        <SectionListHeader>
          <SectionListHeader.Text>{section.title}</SectionListHeader.Text>
        </SectionListHeader>
      );
    },
    []
  );

  const viewabilityConfig = {
    minimumViewTime: 0,
    itemVisiblePercentThreshold: 0,
    waitForInteraction: false,
  };

  const isAtTopRef = useRef(true);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) {
        return;
      }

      if (!isAtTopRef.current) {
        const { section } = viewableItems[0];
        if (section) {
          onSectionChange?.(section.title);
        }
      }
    }
  ).current;

  const handleScroll = useRef(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const atTop = event.nativeEvent.contentOffset.y === 0;
      if (atTop !== isAtTopRef.current) {
        isAtTopRef.current = atTop;
        if (atTop) {
          onSectionChange?.('Home');
        }
      }
    }
  ).current;

  const getChannelKey = useCallback((item: Chat) => {
    if (!item || typeof item !== 'object' || !item.id) {
      return 'invalid-item';
    }

    if (logic.isGroup(item)) {
      return item.id;
    }
    return `${item.id}-${item.pin?.itemId ?? ''}`;
  }, []);

  return (
    <SectionList
      sections={data}
      contentContainerStyle={contentContainerStyle}
      keyExtractor={getChannelKey}
      stickySectionHeadersEnabled={false}
      renderItem={renderItem}
      maxToRenderPerBatch={6}
      initialNumToRender={11}
      windowSize={2}
      viewabilityConfig={viewabilityConfig}
      renderSectionHeader={renderSectionHeader}
      onViewableItemsChanged={onViewableItemsChanged}
      onScroll={handleScroll}
    />
  );
}
