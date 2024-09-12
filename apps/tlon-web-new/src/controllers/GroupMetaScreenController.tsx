import { GroupMetaScreen } from '@tloncorp/app/features/groups/GroupMetaScreen';
import { useNavigate } from 'react-router';

import useGroupIdFromRoute from '@/logic/useGroupIdFromRoute';

export function GroupMetaScreenController() {
  const groupId = useGroupIdFromRoute();
  const navigate = useNavigate();

  return <GroupMetaScreen groupId={groupId} onGoBack={() => navigate(-1)} />;
}
