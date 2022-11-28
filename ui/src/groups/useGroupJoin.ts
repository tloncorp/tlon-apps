import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { useModalNavigate, useDismissNavigate } from '@/logic/routing';
import useHarkState from '@/state/hark';
import { useGroup, useGroupState } from '@/state/groups';
import { Gang, PrivacyType } from '@/types/groups';
import { Status } from '@/logic/status';

function getButtonText(
  privacy: PrivacyType,
  requested: boolean,
  invited: boolean,
  group: boolean
) {
  switch (true) {
    case group:
      return 'Go';
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
  const [status, setStatus] = useState<Status>('initial');
  const location = useLocation();
  const navigate = useNavigate();
  const modalNavigate = useModalNavigate();
  const dismiss = useDismissNavigate();
  const group = useGroup(flag);
  const { privacy } = useGroupPrivacy(flag);
  const requested = gang?.claim?.progress === 'knocking';
  const invited = gang?.invite;

  const open = useCallback(() => {
    if (group) {
      return navigate(`/groups/${flag}`);
    }

    return navigate(`/gangs/${flag}`, {
      state: { backgroundLocation: location },
    });
  }, [flag, group, location, navigate]);

  const join = useCallback(async () => {
    setStatus('loading');

    if (privacy === 'private' && !invited) {
      await useGroupState.getState().knock(flag);
    } else {
      try {
        await useHarkState.getState().sawRope({
          channel: null,
          desk: window.desk,
          group: flag,
          thread: `/${flag}/invite`,
        });
      } catch (error) {
        // no notification
      }

      try {
        await useGroupState.getState().join(flag, true);
        setStatus('success');
        navigate(`/groups/${flag}`);
      } catch (e) {
        setStatus('error');
        navigate(`/find/${flag}`);
        if (requested) {
          await useGroupState.getState().rescind(flag);
        } else {
          await useGroupState.getState().reject(flag);
        }
      }
    }
  }, [privacy, invited, flag, navigate, requested]);

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
    requested,
    dismiss,
    open,
    join,
    status,
    reject,
    button: {
      disabled: requested && !invited,
      text: getButtonText(privacy, requested, !!invited, !!group),
      action: group ? open : join,
    },
  };
}
