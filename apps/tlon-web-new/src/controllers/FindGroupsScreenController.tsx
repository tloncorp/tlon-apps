import { FindGroupsScreen } from '@tloncorp/app/features/top/FindGroupsScreen';
import { useNavigate } from 'react-router';

export function FindGroupsScreenController() {
  const navigate = useNavigate();

  return (
    <FindGroupsScreen
      goBack={() => navigate(-1)}
      goToUserGroups={({ contactId }) => {
        navigate(`/find-groups/${contactId}`);
      }}
    />
  );
}
