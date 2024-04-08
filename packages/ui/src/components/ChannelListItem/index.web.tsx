import type * as db from '@tloncorp/shared/dist/db';
import { useLongPress } from '@uidotdev/usehooks';

import type { ListItemProps } from '../ListItem';
import ListItemContent from './ListItemContent';

const ChannelListItem = ({
  model,
  onPress,
  onLongPress,
  unreadCount,
  ...props
}: ListItemProps<db.Channel>) => {
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

export default ChannelListItem;
