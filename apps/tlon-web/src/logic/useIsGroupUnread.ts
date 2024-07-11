import { ActivitySummary } from '@tloncorp/shared/dist/urbit';
import { useCallback } from 'react';

import { emptySummary, useActivity } from '@/state/activity';

export default function useGroupUnread() {
  const { activity } = useActivity();
  const getGroupUnread = useCallback(
    (flag: string): ActivitySummary => {
      return activity?.[`group/${flag}`] || emptySummary;
    },
    [activity]
  );

  return {
    getGroupUnread,
  };
}
