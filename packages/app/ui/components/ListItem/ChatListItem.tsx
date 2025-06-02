import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { Pressable, Text } from '@tloncorp/ui';
import React, { useMemo } from 'react';
import { View } from 'tamagui';

import { useChatTitle, useGroupTitle } from '../../utils';
import { ContactAvatar, GroupAvatar } from '../Avatar';
import { ChannelListItem } from './ChannelListItem';
import { GroupListItem } from './GroupListItem';
import { ListItemProps } from './ListItem';

// Component for unread badge in compact mode
function UnreadBadge({
  count,
  notified,
}: {
  count: number;
  notified: boolean;
}) {
  if (count === 0) return null;

  return (
    <View
      position="absolute"
      top={-4}
      right={-4}
      backgroundColor={
        notified ? '$primaryActionBackground' : '$secondaryBackground'
      }
      borderRadius="$l"
      paddingHorizontal="$xs"
      paddingVertical="$2xs"
      minWidth={20}
      alignItems="center"
      justifyContent="center"
    >
      <Text fontSize="$xs" color="$primaryText" fontWeight="bold">
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export const ChatListItem = React.memo(function ChatListItemComponent({
  model,
  onPress,
  onLongPress,
  onLayout,
  compact,
  ...props
}: ListItemProps<db.Chat> & {
  onLayout?: (e: any) => void;
  showGroupTitle?: boolean;
  compact?: boolean;
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

  // Get titles for both modes (must be called unconditionally)
  const groupTitle = useGroupTitle(model.type === 'group' ? model.group : null);
  const chatTitle = useChatTitle(
    model.type === 'channel' ? model.channel : null,
    model.type === 'group' ? model.group : null
  );
  const title = model.type === 'group' ? groupTitle : chatTitle;

  // Compact mode rendering
  if (compact) {
    const unreadCount =
      model.type === 'group'
        ? model.group.unread?.count ?? 0
        : model.channel.unread?.count ?? 0;
    const notified =
      model.type === 'group'
        ? model.group.unread?.notify ?? false
        : model.channel.unread?.notify ?? false;
    const isMuted =
      model.type === 'group'
        ? logic.isMuted(model.group.volumeSettings?.level, 'group')
        : logic.isMuted(model.channel.volumeSettings?.level, 'channel');

    const renderAvatar = () => {
      if (model.type === 'group') {
        return <GroupAvatar model={model.group} />;
      }

      // model.type === 'channel'
      const { channel } = model;

      if (channel.type === 'dm' && channel.members?.[0]) {
        return <ContactAvatar contactId={channel.members[0].contactId} />;
      }

      // For group DMs and channels, use a group avatar with channel info
      return (
        <GroupAvatar
          model={
            {
              id: channel.id,
              iconImage: null,
              iconImageColor: null,
              coverImage: null,
              coverImageColor: null,
              title: channel.title || '',
              description: '',
              members: channel.members || [],
            } as any
          }
        />
      );
    };

    return (
      <View width="100%" onLayout={onLayout}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          borderRadius="$m"
          padding="$s"
          hoverStyle={{
            backgroundColor: '$secondaryBackground',
          }}
          pressStyle={{
            backgroundColor: '$secondaryBackground',
          }}
          width="100%"
          alignItems="center"
          // @ts-expect-error - title is a valid HTML attribute but not in the type definitions
          title={title}
        >
          <View position="relative">
            {renderAvatar()}
            {!isMuted && (
              <UnreadBadge count={unreadCount} notified={notified} />
            )}
          </View>
        </Pressable>
      </View>
    );
  }

  // Regular mode rendering
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
