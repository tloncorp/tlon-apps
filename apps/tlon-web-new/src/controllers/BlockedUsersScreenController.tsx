import { BlockedUsersScreen } from '@tloncorp/app/features/settings/BlockedUsersScreen';
import { useNavigate } from 'react-router';

export function BlockedUsersScreenController() {
  const navigate = useNavigate();
  return <BlockedUsersScreen onGoBack={() => navigate(-1)} />;
}
