import type { ClientTypes as Client } from '@tloncorp/shared';
import type { ListItemProps } from '../ListItem';
import { useCallback } from 'react';
import ListItemContent from './ListItemContent';

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  unreadCount,
  ...props
}: ListItemProps<Client.Group>) => {
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
