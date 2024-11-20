import * as db from '@tloncorp/shared/db';
import { GroupPreviewAction } from '@tloncorp/ui';
import { useCallback } from 'react';

import { useGroupNavigation } from './useGroupNavigation';

export const useGroupActions = () => {
  const { goToHome, goToGroupChannels } = useGroupNavigation();

  const performGroupAction = useCallback(
    async (action: GroupPreviewAction, updatedGroup: db.Group) => {
      if (action === 'goTo') {
        goToGroupChannels(updatedGroup.id);
      }

      if (action === 'joined') {
        goToHome();
      }
    },
    [goToGroupChannels, goToHome]
  );

  return {
    performGroupAction,
  };
};
