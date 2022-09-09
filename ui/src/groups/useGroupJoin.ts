import useNavStore from '@/components/Nav/useNavStore';
import { useModalNavigate, useDismissNavigate } from '@/logic/routing';
import { getGroupPrivacy } from '@/logic/utils';
import { useGroup, useGroupState } from '@/state/groups';
import { Gang, PrivacyType } from '@/types/groups';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

function getButtonText(
  privacy: PrivacyType,
  requested: boolean,
  invited: boolean,
  group: boolean
) {
  switch (true) {
    case group:
      return 'Open';
    case requested && !invited:
      return 'Requested';
    case privacy === 'private' && !invited:
      return 'Request to Join';
    default:
      return 'Join';
  }
}

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
  const invited = gang?.invite;
  const navPrimary = useNavStore((state) => state.navigatePrimary);

  const open = useCallback(() => {
    if (group) {
      navPrimary('group', flag);
      return navigate(`/groups/${flag}`);
    }

    return navigate(`/gangs/${flag}`, {
      state: { backgroundLocation: location },
    });
  }, [flag, group, location, navPrimary, navigate]);

  const join = useCallback(async () => {
    if (privacy === 'public' || (privacy === 'private' && invited)) {
      await useGroupState.getState().join(flag, true);
      navPrimary('group', flag);
      navigate(`/groups/${flag}`);
    } else {
      await useGroupState.getState().knock(flag);
    }
  }, [privacy, invited, flag, navPrimary, navigate]);

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
      disabled: requested && !invited,
      text: getButtonText(privacy, requested, !!invited, !!group),
      action: group ? open : join,
    },
  };
}
