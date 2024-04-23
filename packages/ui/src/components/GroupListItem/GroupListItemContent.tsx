import type * as db from '@tloncorp/shared/dist/db';

import { ListItem, type ListItemProps } from '../ListItem';

export default function GroupListItemContent({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<db.GroupSummary>) {
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
      <ListItem.EndContent>
        <ListItem.Time time={model.lastPostAt} />
        {model.unreadCount && model.unreadCount > 0 ? (
          <ListItem.Count>{model.unreadCount}</ListItem.Count>
        ) : null}
      </ListItem.EndContent>
    </ListItem>
  );
}
