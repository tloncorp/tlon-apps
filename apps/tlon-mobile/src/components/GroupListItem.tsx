import type { ListItemProps } from '@tloncorp/ui';
import { ListItem } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import * as db from '../db';

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<db.Group>) => {
  const handlePress = useCallback(() => {
    onPress?.(model);
  }, [onPress, model]);
  const handleLongPress = useCallback(() => {
    onLongPress?.(model);
  }, [onLongPress, model]);
  const unreadCount = useMemo(() => {
    return db.getUnreadChannelCount(model);
  }, [model]);
  return (
    <ListItem {...props} onPress={handlePress} onLongPress={handleLongPress}>
      <ListItem.Icon
        fallbackText={model.title?.[0]}
        backgroundColor={model.iconImageColor}
        imageUrl={model.iconImage}
      />
      <ListItem.MainContent>
        <ListItem.Title>{model.title}</ListItem.Title>
        {/* <ListItem.Subtitle>{model.latestPost?.text}</ListItem.Subtitle> */}
      </ListItem.MainContent>
      <ListItem.EndContent>
        {model.lastPostAt ? (
          <ListItem.Time>
            {new Date(model.lastPostAt).toLocaleDateString()}
          </ListItem.Time>
        ) : null}
        {unreadCount > 0 ? (
          <ListItem.Count>{unreadCount}</ListItem.Count>
        ) : null}
      </ListItem.EndContent>
    </ListItem>
  );
};
