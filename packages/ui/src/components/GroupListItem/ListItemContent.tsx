import type * as client from '@tloncorp/shared/dist/client';
import { useMemo } from 'react';

import { ListItem, type ListItemProps } from '../ListItem';

export default function ListItemContent({
  model,
  onPress,
  onLongPress,
  unreadCount,
  ...props
}: ListItemProps<client.Group>) {
  const lastPostAt = useMemo(() => {
    return new Date('2024-01-01 20:38:00');
  }, []);

  return (
    <ListItem
      {...props}
      onPress={() => onPress?.(model)}
      onLongPress={() => onLongPress?.(model)}
    >
      <ListItem.Icon
        fallbackText={model.title?.[0]}
        backgroundColor={model.iconImageColor}
        imageUrl={model.iconImage}
      />
      <ListItem.MainContent>
        <ListItem.Title>{model.title}</ListItem.Title>
        {/* <ListItem.Subtitle>{model.latestPost?.text}</ListItem.Subtitle> */}
        <ListItem.Subtitle>
          Here's some content, it's a message
        </ListItem.Subtitle>
      </ListItem.MainContent>
      <ListItem.EndContent position="relative" bottom={6}>
        {true ? (
          <ListItem.Time>
            {/* {new Date(model.lastPostAt).toLocaleDateString()} */}
            {lastPostAt.toLocaleDateString()}
          </ListItem.Time>
        ) : null}
        {unreadCount && unreadCount > 0 ? (
          <ListItem.Count>{unreadCount}</ListItem.Count>
        ) : null}
      </ListItem.EndContent>
    </ListItem>
  );
}
