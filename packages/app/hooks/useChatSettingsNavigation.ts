import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const useChatSettingsNavigation = () => {
  const navigate = useNavigate();

  const onPressGroupMeta = useCallback(
    (groupId: string) => {
      navigate(`/group/${groupId}/meta`);
    },
    [navigate]
  );

  const onPressGroupMembers = useCallback(
    (groupId: string) => {
      navigate(`/group/${groupId}/members`);
    },
    [navigate]
  );

  const onPressManageChannels = useCallback(
    (groupId: string) => {
      navigate(`/group/${groupId}/manage-channels`);
    },
    [navigate]
  );

  const onPressGroupPrivacy = useCallback(
    (groupId: string) => {
      navigate(`/group/${groupId}/privacy`);
    },
    [navigate]
  );

  const onPressRoles = useCallback(
    (groupId: string) => {
      navigate(`/group/${groupId}/roles`);
    },
    [navigate]
  );

  const onPressChannelMembers = useCallback(
    (channelId: string) => {
      navigate(`/dm/${channelId}/members`);
    },
    [navigate]
  );

  const onPressChannelMeta = useCallback(
    (channelId: string) => {
      navigate(`/dm/${channelId}/meta`);
    },
    [navigate]
  );

  return {
    onPressChannelMembers,
    onPressChannelMeta,
    onPressGroupMeta,
    onPressGroupMembers,
    onPressManageChannels,
    onPressGroupPrivacy,
    onPressRoles,
  };
};
