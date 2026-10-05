import type * as db from '@tloncorp/shared/db';
import { Icon } from '@tloncorp/ui';
import { ComponentProps, memo } from 'react';
import { View, getTokenValue } from 'tamagui';

import { getChannelTypeIcon } from '../utils';
import { ListItem } from './ListItem';
import { ChannelListItem } from './listItems/ChannelListItem';

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

    const rowProps = {
      model: channel,
      onPress,
      onLayout,
      disableOptions: true,
      disableFocusedStyle: true,
      showGroupTitle: true,
      // A destination needs a name, not its latest message or unread count.
      showActivity: false,
      // Puts the avatar on the sheet's 40pt text edge, under the title.
      paddingHorizontal: '$2xl',
      borderWidth: '$2xs',
      marginHorizontal: -1,
      accessibilityLabel: selected
        ? 'Selected forwarding destination'
        : undefined,
      accessibilityState: { selected },
      ...selectedStyles,
    } as const;

    return (
      <ChannelListItem
        {...rowProps}
        // A channel is recognised by its group, so show the group's own
        // avatar, with the kind of channel as a badge on its corner.
        StartIcon={
          isNonDmGroupChannel(channel) ? (
            <ForwardGroupChannelIcon channel={channel} />
          ) : undefined
        }
        EndContent={<ListItem.SelectionIndicator selected={selected} />}
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
