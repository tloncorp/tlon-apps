import { getGroupPrivacy } from '@/logic/utils';
import { useGroup, useGroupState } from '@/state/groups';
import { Gang } from '@/types/groups';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

export default function useGroupJoin(flag: string, gang: Gang) {
  const location = useLocation();
  const navigate = useNavigate();
  const group = useGroup(flag);
  const privacy = gang.preview?.cordon
    ? getGroupPrivacy(gang.preview?.cordon)
    : 'public';

  const open = useCallback(() => {
    if (group) {
      return navigate(`/groups/${flag}`);
    }

    return navigate(`/gangs/${flag}`, {
      state: { backgroundLocation: location },
    });
  }, [flag, group, location, navigate]);

  const join = useCallback(async () => {
    await useGroupState.getState().join(flag, true);
    navigate(`/groups/${flag}`);
  }, [flag, navigate]);

  const reject = useCallback(async () => {
    /**
     * No need to confirm if the group is public, since it's easy to re-initiate
     * a join request
     */
    if (privacy === 'public') {
      await useGroupState.getState().reject(flag);
      return;
    }

    navigate(`/gangs/${flag}/reject`, {
      state: { backgroundLocation: location },
    });
  }, [flag, location, navigate, privacy]);

  return {
    group,
    privacy,
    open,
    join,
    reject,
  };
}
