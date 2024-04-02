import type * as client from '@tloncorp/shared/dist/client';
import { useCallback } from 'react';

import type { ListItemProps } from '../ListItem';
import ListItemContent from './ListItemContent';

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  unreadCount,
  ...props
}: ListItemProps<client.Group>) => {
  const handlePress = useCallback(() => {
    onPress?.(model);
  }, [onPress, model]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(model);
  }, [onLongPress, model]);

  return (
    <ListItemContent
      model={model}
      onPress={handlePress}
      onLongPress={handleLongPress}
      unreadCount={unreadCount}
      {...props}
    />
  );
};
