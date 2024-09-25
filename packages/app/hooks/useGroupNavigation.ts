import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const useGroupNavigation = () => {
  const navigate = useNavigate();

  const goToChannel = useCallback(
    async (channel: db.Channel) => {
      navigate(`/group/${channel.groupId}/channel/${channel.id}`);
    },
    [navigate]
  );

  const goToHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const goToContactHostedGroups = useCallback(() => {
    navigate('/hosted-groups/:contactId');
  }, [navigate]);

  return {
    goToChannel,
    goToHome,
    goToContactHostedGroups,
  };
};
