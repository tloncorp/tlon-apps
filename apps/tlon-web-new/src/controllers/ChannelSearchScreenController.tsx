import ChannelSearchScreen from '@tloncorp/app/features/top/ChannelSearchScreen';
import { isGroupChannelId } from '@tloncorp/shared/dist';
import { useNavigate } from 'react-router';

import useChannelMeta from '@/logic/useChannelMeta';

export function ChannelSearchScreenController() {
  const navigate = useNavigate();
  const { channel: channelData } = useChannelMeta();

  if (!channelData) {
    return null;
  }
  return (
    <ChannelSearchScreen
      channel={channelData}
      navigateToChannel={({ channel, selectedPostId }) => {
        if (channel.type === 'dm' || channel.type === 'groupDm') {
          if (selectedPostId) {
            navigate(`/dm/${channel.id}/post/${selectedPostId}`);
            return;
          }
          navigate(`/dm/${channel.id}`);
          return;
        }
        if (selectedPostId) {
          navigate(
            `/group/${channel.group?.id}/channel/${channel.id}/${selectedPostId}`
          );
          return;
        }

        navigate(`/group/${channel.group?.id}/channel/${channel.id}`);
      }}
      navigateToReply={({ id, authorId, channelId }) => {
        if (isGroupChannelId(channelId)) {
          navigate(
            `/group/${channelData.group?.id}/channel/${channelId}/post/${authorId}/${id}`
          );
          return;
        }

        navigate(`/dm/${channelId}/post/${authorId}/${id}`);
      }}
      cancelSearch={() => {
        navigate(-1);
      }}
    />
  );
}
