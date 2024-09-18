import { ManageChannelsScreen } from '@tloncorp/app/features/groups/ManageChannelsScreen';
import { useNavigate } from 'react-router';

import useGroupIdFromRoute from '@/logic/useGroupIdFromRoute';

export function ManageChannelsScreenController() {
  const groupId = useGroupIdFromRoute();
  const navigate = useNavigate();

  return (
    <ManageChannelsScreen
      groupId={groupId}
      onGoBack={() => navigate(-1)}
      onGoToEditChannel={(channelId) => {
        navigate(`/group/${groupId}/channel/${channelId}/edit`);
      }}
    />
  );
}
