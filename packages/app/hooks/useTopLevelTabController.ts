import * as store from '@tloncorp/shared/store';
import { triggerHaptic } from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import { useCurrentUserId } from './useCurrentUser';

export function useTopLevelTabController() {
  const currentUserId = useCurrentUserId();
  const haveUnreadActivity = store.useHaveUnreadUnseenActivity();
  const [showStatusSheet, setShowStatusSheet] = useState(false);

  const openStatusSheet = useCallback(() => {
    triggerHaptic('sheetOpen');
    setShowStatusSheet(true);
  }, []);

  const closeStatusSheet = useCallback(() => {
    setShowStatusSheet(false);
  }, []);

  const updateStatus = useCallback(
    (status: string) => {
      store.updateCurrentUserProfile({ status });
      closeStatusSheet();
    },
    [closeStatusSheet]
  );

  return {
    currentUserId,
    haveUnreadActivity,
    statusSheet: {
      open: showStatusSheet,
      openSheet: openStatusSheet,
      closeSheet: closeStatusSheet,
      updateStatus,
    },
  };
}
