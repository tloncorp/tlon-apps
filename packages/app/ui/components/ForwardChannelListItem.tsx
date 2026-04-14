import type * as db from '@tloncorp/shared/db';
import { Icon } from '@tloncorp/ui';
import { ComponentProps, memo } from 'react';
import { View, getTokenValue } from 'tamagui';

import { getChannelTypeIcon } from '../utils';
import { ListItem } from './ListItem';
import { ChannelListItem } from './ListItem/ChannelListItem';

type ForwardChannelListItemProps = {
  channel: db.Channel;
  selected?: boolean;
  onPress: (channel: db.Channel) => void;
  onLayout?: ComponentProps<typeof ListItem>['onLayout'];
};

const FORWARD_CHANNEL_AVATAR = {
  footprint: 48,
  groupSizeToken: '$3.5xl',
  badgeSize: 29,
  badgeRadius: 5,
  badgeOffset: 4,
  iconSizeToken: '$xl',
} as const;

function isNonDmGroupChannel(
  channel: db.Channel
): channel is db.Channel & { group: NonNullable<db.Channel['group']> } {
  return channel.type !== 'dm' && channel.type !== 'groupDm' && !!channel.group;
}

const ForwardGroupChannelIcon = memo(function ForwardGroupChannelIcon({
  channel,
}: {
  channel: db.Channel & { group: NonNullable<db.Channel['group']> };
}) {
  const groupIconSize = getTokenValue(
    FORWARD_CHANNEL_AVATAR.groupSizeToken,
    'size'
  );
  const channelTypeIconSize = getTokenValue(
    FORWARD_CHANNEL_AVATAR.iconSizeToken,
    'size'
  );
  return (
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
        right={-FORWARD_CHANNEL_AVATAR.badgeOffset}
        bottom={-FORWARD_CHANNEL_AVATAR.badgeOffset}
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
  );
});

export const ForwardChannelListItem = memo(
  function ForwardChannelListItem({
    channel,
    selected = false,
    onPress,
    onLayout,
  }: ForwardChannelListItemProps) {
    const selectedStyles = selected
      ? {
          backgroundColor: '$positiveBackground',
          borderColor: '$positiveBorder',
        }
      : { borderColor: 'transparent' };

    const sharedProps = {
      model: channel,
      onPress,
      onLayout,
      disableOptions: true,
      disableFocusedStyle: true,
      showGroupTitle: true,
      borderWidth: '$2xs',
      marginHorizontal: -1,
      ...selectedStyles,
    } as const;

    if (!isNonDmGroupChannel(channel)) {
      return <ChannelListItem {...sharedProps} />;
    }

    return (
      <ChannelListItem
        {...sharedProps}
        StartIcon={<ForwardGroupChannelIcon channel={channel} />}
      />
    );
  },
  (prev, next) =>
    prev.channel.id === next.channel.id &&
    prev.channel.type === next.channel.type &&
    prev.channel.group?.id === next.channel.group?.id &&
    prev.selected === next.selected &&
    prev.onPress === next.onPress &&
    prev.onLayout === next.onLayout
);
