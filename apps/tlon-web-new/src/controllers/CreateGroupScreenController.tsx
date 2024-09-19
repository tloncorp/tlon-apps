import { CreateGroupScreen } from '@tloncorp/app/features/top/CreateGroupScreen';
import type * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export function CreateGroupScreenController() {
  const navigate = useNavigate();

  const handleGoToChannel = useCallback(
    (channel: db.Channel) => {
      navigate(`/group/${channel.groupId}/channel/${channel.id}`, {
        replace: true,
      });
    },
    [navigate]
  );

  return (
    <CreateGroupScreen
      goBack={() => navigate(-1)}
      goToChannel={handleGoToChannel}
    />
  );
}
