import type { ClientTypes as Client } from '@tloncorp/shared';

import { Icon } from '../..';
import { ListItem, type ListItemProps } from '../ListItem';

export default function ListItemContent({
  model,
  onPress,
  onLongPress,
  unreadCount,
  ...props
}: ListItemProps<Client.Channel>) {
  return (
    <ListItem
      {...props}
      onPress={() => onPress?.(model)}
      onLongPress={() => onLongPress?.(model)}
    >
      <ListItem.Icon fallbackText={model.title?.[0]} imageUrl={model.image} />
      <ListItem.MainContent>
        <ListItem.Title>{model.title}</ListItem.Title>
      </ListItem.MainContent>
      <ListItem.EndContent position="relative" top={3}>
        <Icon type="ChevronRight" />
      </ListItem.EndContent>
    </ListItem>
  );
}
