import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import React, { PropsWithChildren, useCallback, useMemo } from 'react';
import {
  SectionList,
  SectionListData,
  SectionListRenderItemInfo,
  StyleProp,
  ViewStyle,
} from 'react-native';

import { useStyle } from '../core';
import ChannelListItem from './ChannelListItem';
import { GroupListItem } from './GroupListItem';
import { ListItemProps } from './ListItem';
import { ListSectionHeader } from './ListSectionHeader';
import { SwipableChatRow } from './SwipableChatListItem';

export function ChatList({
  pinned,
  unpinned,
  onLongPressItem,
  onPressItem,
}: store.CurrentChats & {
  onPressItem?: (chat: db.ChannelSummary) => void;
  onLongPressItem?: (chat: db.ChannelSummary) => void;
}) {
  const data = useMemo(() => {
    if (pinned.length === 0) {
      return [{ title: 'All', data: unpinned }];
    }

    return [
      { title: 'Pinned', data: pinned },
      { title: 'All', data: unpinned },
    ];
  }, [pinned, unpinned]);

  const contentContainerStyle = useStyle(
    {
      gap: '$s',
      paddingHorizontal: '$l',
    },
    { resolveValues: 'value' }
  ) as StyleProp<ViewStyle>;

  const renderItem = useCallback(
    ({
      item,
    }: SectionListRenderItemInfo<db.ChannelSummary, { title: string }>) => {
      return (
        <SwipableChatRow model={item}>
          <ChatListItem
            model={item}
            onPress={onPressItem}
            onLongPress={onLongPressItem}
          />
        </SwipableChatRow>
      );
    },
    []
  );

  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: SectionListData<db.ChannelSummary, { title: string }>;
    }) => {
      return <ListSectionHeader>{section.title}</ListSectionHeader>;
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

function getChannelKey(channel: db.ChannelSummary) {
  return channel.id;
}

const ChatListItem = React.memo(
  ({
    model,
    onPress,
    onLongPress,
    ...props
  }: ListItemProps<db.ChannelSummary>) => {
    const handlePress = useCallback(() => {
      onPress?.(model);
    }, [onPress]);

    const handleLongPress = useCallback(() => {
      onLongPress?.(model);
    }, [onLongPress]);

    if (model.type === 'dm' || model.type === 'groupDm') {
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
    } else {
      console.warn('unable to render chat list item', model.id);
      return null;
    }
  }
);
