import * as db from '@tloncorp/shared/dist/db';
import { GroupPreviewAction } from '@tloncorp/ui';
import { useCallback } from 'react';

import { useGroupNavigation } from './useGroupNavigation';

export const useGroupActions = () => {
  const { goToChannel, goToHome } = useGroupNavigation();

  const performGroupAction = useCallback(
    async (action: GroupPreviewAction, updatedGroup: db.Group) => {
      if (action === 'goTo' && updatedGroup.lastPost?.channelId) {
        const channel = await db.getChannel({
          id: updatedGroup.lastPost.channelId,
        });
        if (channel) {
          goToChannel(channel);
        }
      }

      if (action === 'joined') {
        goToHome();
      }
    },
    [goToChannel, goToHome]
  );

  return {
    performGroupAction,
  };
};
