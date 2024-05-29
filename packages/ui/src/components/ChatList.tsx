import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import React, { useCallback, useMemo } from 'react';
import {
  SectionList,
  SectionListData,
  SectionListRenderItemInfo,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStyle } from '../core';
import ChannelListItem from './ChannelListItem';
import { GroupListItem } from './GroupListItem';
import { ListItemProps } from './ListItem';
import { SectionListHeader } from './ListSectionHeader';
import { navHeight } from './NavBar/NavBar';
import { SwipableChatRow } from './SwipableChatListItem';

type ListItem = db.Channel | db.Group;

export function ChatList({
  pinned,
  unpinned,
  pendingChats,
  onLongPressItem,
  onPressItem,
}: store.CurrentChats & {
  onPressItem?: (chat: ListItem) => void;
  onLongPressItem?: (chat: ListItem) => void;
}) {
  const { bottom } = useSafeAreaInsets();

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
      paddingTop: '$l',
      paddingHorizontal: '$l',
      paddingBottom: navHeight + bottom,
    },
    { resolveValues: 'value' }
  ) as StyleProp<ViewStyle>;

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<ListItem, { title: string }>) => {
      const listItemElement = (
        <ChatListItem
          model={item}
          onPress={onPressItem}
          onLongPress={onLongPressItem}
        />
      );
      if (logic.isChannel(item)) {
        return (
          <SwipableChatRow model={item}>{listItemElement}</SwipableChatRow>
        );
      }
      // Pending items not affected by swipe
      return listItemElement;
    },
    [onPressItem, onLongPressItem]
  );

  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: SectionListData<ListItem, { title: string }>;
    }) => {
      return (
        <SectionListHeader>
          <SectionListHeader.Text>{section.title}</SectionListHeader.Text>
        </SectionListHeader>
      );
    },
    []
  );

  return (
    <SectionList
      sections={data}
      contentContainerStyle={contentContainerStyle}
      keyExtractor={getChannelKey}
      stickySectionHeadersEnabled={false}
      renderItem={renderItem}
      maxToRenderPerBatch={11}
      initialNumToRender={11}
      windowSize={2}
      viewabilityConfig={{
        minimumViewTime: 1000,
        itemVisiblePercentThreshold: 50,
      }}
      renderSectionHeader={renderSectionHeader}
    />
  );
}

function getChannelKey(item: ListItem) {
  if (logic.isGroup(item)) return item.id;
  return item.id + item.pin?.itemId ?? '';
}

const ChatListItem = React.memo(function ChatListItemComponent({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<ListItem>) {
  const handlePress = useCallback(() => {
    onPress?.(model);
  }, [model, onPress]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(model);
  }, [model, onLongPress]);

  // if the chat list item is a group, it's pending
  if (logic.isGroup(model)) {
    return (
      <GroupListItem
        onPress={handlePress}
        model={{
          ...model,
        }}
        borderRadius="$m"
        {...props}
      />
    );
  }

  if (logic.isChannel(model)) {
    if (
      model.type === 'dm' ||
      model.type === 'groupDm' ||
      model.pin?.type === 'channel'
    ) {
      return (
        <ChannelListItem
          model={model}
          onPress={handlePress}
          onLongPress={handleLongPress}
          {...props}
        />
      );
    } else if (model.group) {
      return (
        <GroupListItem
          onPress={handlePress}
          onLongPress={handleLongPress}
          model={{
            ...model.group,
            unreadCount: model.unread?.count,
            lastPost: model.lastPost,
          }}
          borderRadius="$m"
          {...props}
        />
      );
    }
  }

  console.warn('unable to render chat list item', model.id, model);
  return null;
});
