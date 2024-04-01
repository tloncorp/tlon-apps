import type { ClientTypes as Client } from '@tloncorp/shared';
import { useLongPress } from '@uidotdev/usehooks';

import type { ListItemProps } from '../ListItem';
import ListItemContent from './ListItemContent';

export const ChannelListItem = ({
  model,
  onPress,
  onLongPress,
  unreadCount,
  ...props
}: ListItemProps<Client.Channel>) => {
  // TODO: Figure out if this is necessary. Why can't we use Tamagui's long press handler?
  const attributes = useLongPress(
    () => {
      onLongPress?.(model);
    },
    { threshold: 600 }
  );

  return (
    <div {...attributes}>
      <ListItemContent
        model={model}
        onPress={onPress}
        unreadCount={unreadCount}
        {...props}
      />
    </div>
  );
};
