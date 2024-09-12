import { GroupPrivacyScreen } from '@tloncorp/app/features/groups/GroupPrivacyScreen';
import { useNavigate } from 'react-router';

import useGroupIdFromRoute from '@/logic/useGroupIdFromRoute';

export function GroupPrivacyScreenController() {
  const groupId = useGroupIdFromRoute();
  const navigate = useNavigate();

  return <GroupPrivacyScreen groupId={groupId} onGoBack={() => navigate(-1)} />;
}
