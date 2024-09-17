import * as db from '@tloncorp/shared/dist/db';
import { GroupPreviewAction } from '@tloncorp/ui';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const useGroupActions = () => {
  const navigate = useNavigate();

  const performGroupAction = useCallback(
    async (action: GroupPreviewAction, updatedGroup: db.Group) => {
      if (action === 'goTo' && updatedGroup.lastPost?.channelId) {
        const channel = await db.getChannel({
          id: updatedGroup.lastPost.channelId,
        });
        if (channel) {
          navigate('/group/' + channel.groupId + '/channel/' + channel.id);
        }
      }

      if (action === 'joined') {
        navigate('/');
      }
    },
    [navigate]
  );

  return {
    performGroupAction,
  };
};
