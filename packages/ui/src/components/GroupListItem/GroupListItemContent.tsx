import type * as db from '@tloncorp/shared/dist/db';

import { ListItem, type ListItemProps } from '../ListItem';

export default function GroupListItemContent({
  model,
  onPress,
  onLongPress,
  unreadCount,
  ...props
}: ListItemProps<db.GroupInsert>) {
  return (
    <ListItem
      {...props}
      onPress={() => onPress?.(model)}
      onLongPress={() => onLongPress?.(model)}
    >
      <ListItem.Icon
        fallbackText={model.title?.[0]}
        backgroundColor={model.iconImageColor ?? undefined}
        imageUrl={model.iconImage ?? undefined}
      />
      <ListItem.MainContent>
        <ListItem.Title>{model.title}</ListItem.Title>
        <ListItem.Subtitle>
          {model.lastPost?.textContent ?? ''}
        </ListItem.Subtitle>
      </ListItem.MainContent>
      <ListItem.EndContent position="relative" bottom={6}>
        {true ? (
          <ListItem.Time>
            {model.lastPostAt
              ? new Date(model.lastPostAt).toLocaleDateString()
              : null}
          </ListItem.Time>
        ) : null}
        {unreadCount && unreadCount > 0 ? (
          <ListItem.Count>{unreadCount}</ListItem.Count>
        ) : null}
      </ListItem.EndContent>
    </ListItem>
  );
}
