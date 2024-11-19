import * as db from '@tloncorp/shared/db';
import { GroupPreviewAction } from '@tloncorp/ui';
import { useCallback } from 'react';

import { useGroupNavigation } from './useGroupNavigation';

export const useGroupActions = () => {
  const { goToChannel, goToHome, goToGroup } = useGroupNavigation();

  const performGroupAction = useCallback(
    async (action: GroupPreviewAction, updatedGroup: db.Group) => {
      // if (action === 'goTo' && updatedGroup.lastPost?.channelId) {
      //   const channel = await db.getChannel({
      //     id: updatedGroup.lastPost.channelId,
      //   });
      //   if (channel) {
      //     goToChannel(channel);
      //   }
      // }

      // TODO: is there anywhere we call this where could be dm?
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
