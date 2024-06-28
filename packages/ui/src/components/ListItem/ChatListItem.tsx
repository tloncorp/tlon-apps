import * as logic from '@tloncorp/shared/dist/logic';
import React, { useCallback } from 'react';

import { Chat } from '../ChatList';
import { ChannelListItem } from './ChannelListItem';
import { GroupListItem } from './GroupListItem';
import { ListItemProps } from './ListItem';

export const ChatListItem = React.memo(function ChatListItemComponent({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<Chat>) {
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
            lastChannel: model.title,
          }}
          {...props}
        />
      );
    }
  }

  console.warn('unable to render chat list item', model.id, model);
  return null;
});
