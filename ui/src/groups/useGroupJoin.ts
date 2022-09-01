import { useModalNavigate, useDismissNavigate } from '@/logic/routing';
import { getGroupPrivacy } from '@/logic/utils';
import { useGroup, useGroupState } from '@/state/groups';
import { Gang } from '@/types/groups';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

export default function useGroupJoin(
  flag: string,
  gang: Gang,
  inModal = false
) {
  const location = useLocation();
  const navigate = useNavigate();
  const modalNavigate = useModalNavigate();
  const dismiss = useDismissNavigate();
  const group = useGroup(flag);
  const privacy = gang.preview?.cordon
    ? getGroupPrivacy(gang.preview?.cordon)
    : 'public';
  const requested = gang?.claim?.progress === 'knocking';

  const open = useCallback(() => {
    if (group) {
      return navigate(`/groups/${flag}`);
    }

    return navigate(`/gangs/${flag}`, {
      state: { backgroundLocation: location },
    });
  }, [flag, group, location, navigate]);

  const join = useCallback(async () => {
    if (privacy === 'public') {
      await useGroupState.getState().join(flag, true);
      navigate(`/groups/${flag}`);
    } else {
      await useGroupState.getState().knock(flag);
    }
  }, [flag, privacy, navigate]);

  const reject = useCallback(async () => {
    /**
     * No need to confirm if the group is public, since it's easy to re-initiate
     * a join request
     */
    if (privacy === 'public') {
      await useGroupState.getState().reject(flag);

      if (inModal) {
        dismiss();
      }
      return;
    }

    const navFn = inModal ? modalNavigate : navigate;
    navFn(`/gangs/${flag}/reject`, {
      state: { backgroundLocation: location },
    });
  }, [flag, inModal, location, dismiss, navigate, modalNavigate, privacy]);

  return {
    group,
    privacy,
    dismiss,
    open,
    join,
    reject,
    button: {
      disabled: requested,
      text: group
        ? 'Open'
        : requested
        ? 'Requested'
        : privacy === 'private'
        ? 'Request to Join'
        : 'Join',
      action: group ? open : join,
    },
  };
}
