import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import React, { useMemo } from 'react';

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
  const handlePress = logic.useMutableCallback(() => {
    onPress?.(model);
  });

  const handleLongPress = logic.useMutableCallback(() => {
    onLongPress?.(model);
  });

  // if the chat list item is a group, it's pending
  if (logic.isGroup(model)) {
    return (
      <GroupListItem
        onPress={handlePress}
        onLongPress={handleLongPress}
        model={model}
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
        <GroupListItemAdapter
          model={model}
          groupModel={model.group}
          onPress={handlePress}
          onLongPress={handleLongPress}
          {...props}
        />
      );
    }
  }

  console.warn('unable to render chat list item', model.id, model);
  return null;
});

function GroupListItemAdapter({
  model,
  groupModel,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<Chat> & {
  groupModel: db.Group;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const resolvedModel = useMemo(() => {
    return {
      ...groupModel,
      unreadCount: model.unread?.count,
      lastPost: model.lastPost,
      lastChannel: model.title,
    };
  }, [model, groupModel]);
  return (
    <GroupListItem
      onPress={onPress}
      onLongPress={onLongPress}
      model={resolvedModel}
      {...props}
    />
  );
}
