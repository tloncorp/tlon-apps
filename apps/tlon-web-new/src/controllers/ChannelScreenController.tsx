import ChannelScreen from '@tloncorp/app/features/top/ChannelScreen';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

import useChannelMeta from '@/logic/useChannelMeta';

export function ChannelScreenController() {
  const navigate = useNavigate();
  const { channel, group, postId, isDm } = useChannelMeta();
  const handleGoToDm = useCallback(
    async (dmChannel: db.Channel) => {
      navigate(`/dm/${dmChannel.id}`);
    },
    [navigate]
  );

  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      navigate(`/profile/${userId}`);
    },
    [navigate]
  );

  const handleGoBack = useCallback(() => {
    navigate('..');
  }, [navigate]);

  if (!channel || (!isDm && !group)) {
    return null;
  }

  return (
    <ChannelScreen
      channelFromParams={channel}
      selectedPostId={postId}
      groupFromParams={group}
      navigateToDm={handleGoToDm}
      goBack={handleGoBack}
      navigateToUserProfile={handleGoToUserProfile}
    />
  );
}
