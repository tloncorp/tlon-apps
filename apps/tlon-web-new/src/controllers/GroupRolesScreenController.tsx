import { GroupRolesScreen } from '@tloncorp/app/features/groups/GroupRolesScreen';
import { useNavigate } from 'react-router';

import useGroupIdFromRoute from '@/logic/useGroupIdFromRoute';

export function GroupRolesScreenController() {
  const groupId = useGroupIdFromRoute();
  const navigate = useNavigate();

  return <GroupRolesScreen groupId={groupId} onGoBack={() => navigate(-1)} />;
}
