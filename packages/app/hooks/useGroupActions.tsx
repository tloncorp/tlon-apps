import * as db from '@tloncorp/shared/db';
import { GroupPreviewAction } from '../ui';
import { useCallback } from 'react';

import { useGroupNavigation } from './useGroupNavigation';

export const useGroupActions = () => {
  const { goToHome, goToGroup } = useGroupNavigation();

  const performGroupAction = useCallback(
    async (action: GroupPreviewAction, updatedGroup: db.Group) => {
      if (action === 'goTo') {
        goToGroup(updatedGroup.id);
      }

      if (action === 'joined') {
        goToHome();
      }
    },
    [goToGroup, goToHome]
  );

  return {
    performGroupAction,
  };
};
