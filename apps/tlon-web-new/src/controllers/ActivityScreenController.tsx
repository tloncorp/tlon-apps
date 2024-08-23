import { ActivityScreen } from '@tloncorp/app/features/top/ActivityScreen';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export function ActivityScreenController() {
  const navigate = useNavigate();
  const handleGoToChannel = useCallback(
    (channel: db.Channel, selectedPostId?: string) => {
      navigate(`/group/${channel.groupId}/channel/${channel.id}`);
    },
    [navigate]
  );

  // TODO: if diary or gallery, figure out a way to pop open the comment
  // sheet
  const handleGoToThread = useCallback(
    (post: db.Post) => {
      // TODO: we have no way to route to specific thread message rn
      navigate(
        `/group/${post.groupId}/channel/${post.channelId}/post/${post.authorId}/${post.id}`
      );
    },
    [navigate]
  );

  const handleGoToGroup = useCallback(
    (group: db.Group) => {
      store.markGroupRead(group);
      navigate(`/group/members/${group.id}`);
    },
    [navigate]
  );

  return (
    <ActivityScreen
      navigateToChannel={handleGoToChannel}
      navigateToThread={handleGoToThread}
      navigateToGroup={handleGoToGroup}
      navigateToChatList={() => navigate('/')}
      navigateToActivity={() => '/activity'}
      navigateToProfile={() => navigate('/profile')}
    />
  );
}
