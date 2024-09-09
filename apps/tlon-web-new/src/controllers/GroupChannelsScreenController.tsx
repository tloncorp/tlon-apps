import { GroupChannelsScreen } from '@tloncorp/app/features/top/GroupChannelsScreen';
import { useGroup } from '@tloncorp/shared/dist';
import { useNavigate } from 'react-router';

import useGroupIdFromRoute from '@/logic/useGroupIdFromRoute';

export function GroupChannelsScreenController() {
  const groupId = useGroupIdFromRoute();
  const navigate = useNavigate();
  const { data: group } = useGroup({ id: groupId });

  if (!group) {
    return null;
  }

  return (
    <GroupChannelsScreen
      groupParam={group}
      navigateToChannel={(channel) => {
        navigate(`/group/${groupId}/channel/${channel.id}`);
      }}
      goBack={() => {
        navigate(-1);
      }}
    />
  );
}
