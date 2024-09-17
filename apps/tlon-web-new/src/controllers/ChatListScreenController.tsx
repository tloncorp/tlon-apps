import ChatListScreen from '@tloncorp/app/features/top/ChatListScreen';
import { isDmChannelId } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export function ChatListScreenController() {
  const navigate = useNavigate();

  const handleNavigateToChannel = useCallback(
    (channel: db.Channel, postId?: string | null) => {
      if (isDmChannelId(channel.id)) {
        if (postId) {
          navigate(`/dm/${channel.id}/${postId}`);
        } else {
          navigate(`/dm/${channel.id}`);
        }
      } else {
        if (postId) {
          navigate(`/group/${channel.groupId}/channel/${channel.id}/${postId}`);
        } else {
          navigate(`/group/${channel.groupId}/channel/${channel.id}`);
        }
      }
    },
    [navigate]
  );

  return (
    <>
      <ChatListScreen
        navigateToChannel={(channel) => {
          navigate(`/dm/${channel.id}`);
        }}
        navigateToGroupChannels={(group) => {
          navigate(`/group/${group.id}`);
        }}
        navigateToSelectedPost={handleNavigateToChannel}
        navigateToHome={() => {
          navigate('/');
        }}
        navigateToNotifications={() => {
          navigate('/activity');
        }}
        navigateToProfile={() => {
          navigate('/profile');
        }}
        navigateToFindGroups={() => {
          navigate('/find-groups');
        }}
      />
    </>
  );
}
