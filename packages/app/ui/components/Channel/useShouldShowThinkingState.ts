import * as db from '@tloncorp/shared/db';
import { useMemo } from 'react';

import { useCurrentUserId } from '../../../hooks/useCurrentUser';
import { useCanRead } from '../../utils';

export function useShouldShowThinkingState(channel: db.Channel) {
  const currentUserId = useCurrentUserId();
  const canRead = useCanRead(channel, currentUserId);

  const shouldShowThinkingState = useMemo(
    () => canRead && (channel.type === 'dm' || channel.type === 'chat'),
    [canRead, channel.type]
  );

  return shouldShowThinkingState;
}
