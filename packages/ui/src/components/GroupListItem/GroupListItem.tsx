import type * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';

import type { ListItemProps } from '../ListItem';
import GroupListItemContent from './GroupListItemContent';

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<db.GroupSummary>) => {
  const handlePress = useCallback(() => {
    onPress?.(model);
  }, [onPress, model]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(model);
  }, [onLongPress, model]);

  return (
    <GroupListItemContent
      model={model}
      onPress={handlePress}
      onLongPress={handleLongPress}
      {...props}
    />
  );
};
