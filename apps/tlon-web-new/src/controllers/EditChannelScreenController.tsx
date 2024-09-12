import { EditChannelScreen } from '@tloncorp/app/features/groups/EditChannelScreen';
import { useNavigate } from 'react-router';

import useChannelMeta from '@/logic/useChannelMeta';

export function EditChannelScreenController() {
  const { groupId, channelId } = useChannelMeta();
  const navigate = useNavigate();

  return (
    <EditChannelScreen
      groupId={groupId}
      channelId={channelId}
      onGoBack={() => navigate(-1)}
    />
  );
}
