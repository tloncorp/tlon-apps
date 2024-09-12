import { UserProfileScreen } from '@tloncorp/app/features/top/UserProfileScreen';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';

export default function UserProfileScreenController() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  const handleGoToDm = useCallback(
    async (participants: string[]) => {
      const dmChannel = await store.upsertDmChannel({
        participants,
      });

      navigate(`/dm/${dmChannel.id}`);
    },
    [navigate]
  );

  if (!userId) {
    return null;
  }

  return (
    <UserProfileScreen
      userId={userId}
      onGoBack={() => navigate(-1)}
      onPressGoToDm={handleGoToDm}
    />
  );
}
