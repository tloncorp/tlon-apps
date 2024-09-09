import { GroupMembersScreen } from '@tloncorp/app/features/groups/GroupMembersScreen';
import { useNavigate } from 'react-router';

import useGroupIdFromRoute from '@/logic/useGroupIdFromRoute';

export function GroupMembersScreenController() {
  const groupId = useGroupIdFromRoute();
  const navigate = useNavigate();

  return <GroupMembersScreen onGoBack={() => navigate(-1)} groupId={groupId} />;
}
