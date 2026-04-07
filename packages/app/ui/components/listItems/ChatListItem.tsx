import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import React, { useMemo } from 'react';

import { ChannelListItem } from './ChannelListItem';
import { GroupListItem } from './GroupListItem';
import { ListItemProps } from './ListItem';

export const ChatListItem = React.memo(function ChatListItemComponent({
  model,
  onPress,
  onLongPress,
  onLayout,
  ...props
}: ListItemProps<db.Chat> & {
  onLayout?: (e: any) => void;
  showGroupTitle?: boolean;
}) {
  const handlePress = logic.useMutableCallback(() => {
    onPress?.(model);
  });

  const handleLongPress = logic.useMutableCallback(() => {
    onLongPress?.(model);
  });

  const customSubtitle = useMemo(() => {
    if (
      model.type === 'channel' &&
      model.channel.isNewMatchedContact &&
      model.channel.lastPostId === null
    ) {
      // show this subtitle only if the channel has no posts
      return 'is on Tlon Messenger';
    }
  }, [model]);

  if (model.type === 'group') {
    return (
      <GroupListItem
        onPress={handlePress}
        onLongPress={handleLongPress}
        model={model.group}
        onLayout={onLayout}
        {...props}
      />
    );
  } else {
    return (
      <ChannelListItem
        model={model.channel}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onLayout={onLayout}
        customSubtitle={customSubtitle}
        {...props}
      />
    );
  }
});
