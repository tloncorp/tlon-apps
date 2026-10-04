import type * as db from '@tloncorp/shared/db';
import { ComponentProps, memo } from 'react';

import { ListItem } from './ListItem';
import { ChannelListItem } from './listItems/ChannelListItem';

type ForwardChannelListItemProps = {
  channel: db.Channel;
  selected?: boolean;
  onPress: (channel: db.Channel) => void;
  onLayout?: ComponentProps<typeof ListItem>['onLayout'];
};

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

    const group =
      channel.type !== 'dm' && channel.type !== 'groupDm'
        ? channel.group
        : null;

    return (
      <ChannelListItem
        {...rowProps}
        // A channel is recognised by its group, so show the group's own
        // avatar rather than the channel's initial.
        StartIcon={group ? <ListItem.GroupIcon model={group} /> : undefined}
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
