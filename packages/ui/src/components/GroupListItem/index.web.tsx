import type { ClientTypes as Client } from '@tloncorp/shared';
import type { ListItemProps } from '../ListItem';
import { useLongPress } from '@uidotdev/usehooks';
import ListItemContent from './ListItemContent';

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  unreadCount,
  ...props
}: ListItemProps<Client.Group>) => {
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
