import type * as db from '@tloncorp/shared/dist/db';

import { Icon } from '../..';
import { ListItem, type ListItemProps } from '../ListItem';

export default function ListItemContent({
  model,
  onPress,
  onLongPress,
  unreadCount,
  ...props
}: ListItemProps<db.Channel>) {
  return (
    <ListItem
      {...props}
      onPress={() => onPress?.(model)}
      onLongPress={() => onLongPress?.(model)}
    >
      <ListItem.Icon
        fallbackText={model.title?.[0]}
        imageUrl={model.iconImage ?? undefined}
      />
      <ListItem.MainContent>
        <ListItem.Title>{model.title}</ListItem.Title>
      </ListItem.MainContent>
      <ListItem.EndContent position="relative" top={3}>
        <Icon type="ChevronRight" />
      </ListItem.EndContent>
    </ListItem>
  );
}
