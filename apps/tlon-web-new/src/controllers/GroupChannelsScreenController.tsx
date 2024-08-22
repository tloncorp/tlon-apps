import { GroupChannelsScreen } from '@tloncorp/app/features/top/GroupChannelsScreen';
import { useGroup } from '@tloncorp/shared/dist';
import { useNavigate, useParams } from 'react-router';

export function GroupChannelsScreenController() {
  // const groupParam = route.params.group;
  const { ship, name } = useParams();
  const groupId = `${ship}/${name}`;
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
