import * as logic from '@tloncorp/shared/logic';
import type * as db from '@tloncorp/shared/db';
import { Icon, Pressable } from '@tloncorp/ui';
import { ComponentProps, useState } from 'react';
import { View, getTokenValue, isWeb } from 'tamagui';

import { getChannelTypeIcon, useChannelTitle, useGroupTitle } from '../utils';
import { Badge } from './Badge';
import { ListItem } from './ListItem';
import { ChannelListItem } from './ListItem/ChannelListItem';

type ForwardChannelListItemProps = {
  channel: db.Channel;
  selected?: boolean;
  onPress: (channel: db.Channel) => void;
  onLayout?: ComponentProps<typeof ListItem>['onLayout'];
};

const FORWARD_CHANNEL_AVATAR = {
  footprint: 52,
  groupSizeToken: '$3.5xl',
  badgeSize: 29,
  badgeRadius: 5,
  iconSizeToken: '$xl',
} as const;

function isNonDmGroupChannel(
  channel: db.Channel
): channel is db.Channel & { group: NonNullable<db.Channel['group']> } {
  return (
    channel.type !== 'dm' && channel.type !== 'groupDm' && !!channel.group
  );
}

export function ForwardChannelListItem({
  channel,
  selected = false,
  onPress,
  onLayout,
}: ForwardChannelListItemProps) {
  const title = useChannelTitle(channel);
  const groupTitle = useGroupTitle(channel.group);
  const [isHovered, setIsHovered] = useState(false);
  const groupIconSize = getTokenValue(FORWARD_CHANNEL_AVATAR.groupSizeToken, 'size');
  const channelTypeIconSize = getTokenValue(FORWARD_CHANNEL_AVATAR.iconSizeToken, 'size');

  const unreadCount = channel.unread?.count ?? 0;
  const notified = channel.unread?.notify ?? false;

  const selectedStyles = selected
    ? { backgroundColor: '$positiveBackground', borderColor: '$positiveBorder' }
    : { borderColor: 'transparent' };

  if (!isNonDmGroupChannel(channel)) {
    return (
      <ChannelListItem
        model={channel}
        onPress={onPress}
        onLayout={onLayout}
        disableOptions
        showGroupTitle
        borderWidth="$2xs"
        marginHorizontal={-1}
        {...selectedStyles}
      />
    );
  }

  return (
    <Pressable
      borderRadius="$xl"
      onPress={() => onPress(channel)}
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
      onHoverIn={() => {
        if (isWeb) {
          setIsHovered(true);
        }
      }}
      onHoverOut={() => {
        if (isWeb) {
          setIsHovered(false);
        }
      }}
    >
      <ListItem
        onLayout={onLayout}
        borderWidth="$2xs"
        marginHorizontal={-1}
        {...selectedStyles}
      >
        <View
          width={FORWARD_CHANNEL_AVATAR.footprint}
          height={FORWARD_CHANNEL_AVATAR.footprint}
          position="relative"
          overflow="visible"
        >
          <ListItem.GroupIcon
            model={channel.group}
            membersLayout="compact"
            size="custom"
            width={groupIconSize}
            height={groupIconSize}
            position="absolute"
            top={0}
            left={0}
          />
          <View
            position="absolute"
            right={0}
            bottom={0}
            width={FORWARD_CHANNEL_AVATAR.badgeSize}
            height={FORWARD_CHANNEL_AVATAR.badgeSize}
            borderRadius={FORWARD_CHANNEL_AVATAR.badgeRadius}
            backgroundColor="$secondaryBackground"
            borderWidth={1}
            borderColor="$border"
            alignItems="center"
            justifyContent="center"
          >
            <Icon
              type={getChannelTypeIcon(channel.type) ?? 'Channel'}
              customSize={[channelTypeIconSize, channelTypeIconSize]}
              color="$secondaryText"
            />
          </View>
        </View>

        <ListItem.MainContent>
          <ListItem.Title>{title}</ListItem.Title>
          {groupTitle ? <ListItem.Subtitle>{groupTitle}</ListItem.Subtitle> : null}
          {channel.lastPost && !channel.isDmInvite ? (
            <ListItem.PostPreview post={channel.lastPost} showAuthor />
          ) : null}
        </ListItem.MainContent>

        <ListItem.EndContent>
          {channel.lastPost?.receivedAt ? (
            <ListItem.Time time={channel.lastPost.receivedAt} />
          ) : null}
          {channel.isDmInvite ? (
            <Badge text="Invite" />
          ) : (
            <ListItem.Count
              opacity={isHovered ? 0 : 1}
              notified={notified}
              count={unreadCount}
              muted={logic.isMuted(channel.volumeSettings?.level, 'channel')}
              marginTop={isWeb ? 3 : 'unset'}
            />
          )}
        </ListItem.EndContent>
      </ListItem>
    </Pressable>
  );
}
