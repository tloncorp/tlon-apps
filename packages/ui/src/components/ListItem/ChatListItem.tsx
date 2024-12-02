import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import React from 'react';

import { ChannelListItem } from './ChannelListItem';
import { GroupListItem } from './GroupListItem';
import { ListItemProps } from './ListItem';

export const ChatListItem = React.memo(function ChatListItemComponent({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<db.Chat>) {
  const handlePress = logic.useMutableCallback(() => {
    onPress?.(model);
  });

  const handleLongPress = logic.useMutableCallback(() => {
    onLongPress?.(model);
  });

  if (model.type === 'group') {
    return (
      <GroupListItem
        onPress={handlePress}
        onLongPress={handleLongPress}
        model={model.group}
        {...props}
      />
    );
  } else {
    return (
      <ChannelListItem
        model={model.channel}
        onPress={handlePress}
        onLongPress={handleLongPress}
        {...props}
      />
    );
  }
});
