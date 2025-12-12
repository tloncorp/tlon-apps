import { createDevLogger } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo, useState } from 'react';

const logger = createDevLogger('useInviteUsers', false);

export function useInviteGroupMembers(groupId: string, onComplete: () => void) {
  const [loading, setLoading] = useState(false);
  const [invitees, setInvitees] = useState<string[]>([]);

  const handleInvite = useCallback(async () => {
    setLoading(true);
    try {
      await store.inviteGroupMembers({
        groupId,
        contactIds: invitees,
      });
      setLoading(false);
      onComplete();
    } catch (error) {
      logger.trackError('Error inviting group members', error);
      throw error; // Re-throw so calling components can handle if needed
    } finally {
      setLoading(false);
    }
  }, [invitees, groupId, onComplete]);

  const buttonText = useMemo(() => {
    if (invitees.length === 0) {
      return 'Select people to invite';
    }
    return `Invite ${invitees.length} and continue`;
  }, [invitees]);

  return {
    loading,
    invitees,
    setInvitees,
    handleInvite,
    buttonText,
  };
}
