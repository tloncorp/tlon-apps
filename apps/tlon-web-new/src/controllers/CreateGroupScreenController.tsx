import { CreateGroupScreen } from '@tloncorp/app/features/top/CreateGroupScreen';
import { useNavigate } from 'react-router';

export function CreateGroupScreenController() {
  const navigate = useNavigate();

  return <CreateGroupScreen goBack={() => navigate(-1)} />;
}
