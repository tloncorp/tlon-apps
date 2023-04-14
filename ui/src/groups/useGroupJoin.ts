import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { useModalNavigate, useDismissNavigate } from '@/logic/routing';
import {
  useGroup,
  useGroupJoinMutation,
  useGroupKnockMutation,
  useGroupRejectMutation,
  useGroupRescindMutation,
} from '@/state/groups';
import { Gang, PrivacyType } from '@/types/groups';
import useNavigateByApp from '@/logic/useNavigateByApp';
import { useSawRopeMutation } from '@/state/hark';

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
  inModal = false,
  redirectItem:
    | { nest: string; id: string; type: string }
    | undefined = undefined
) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigateByApp = useNavigateByApp();
  const modalNavigate = useModalNavigate();
  const dismiss = useDismissNavigate();
  const group = useGroup(flag);
  const { privacy } = useGroupPrivacy(flag);
  const requested = gang?.claim?.progress === 'knocking';
  const invited = gang?.invite;
  const { mutate: joinMutation, status } = useGroupJoinMutation();
  const { mutate: knockMutation, status: knockStatus } =
    useGroupKnockMutation();
  const { mutate: rescindMutation, status: rescindStatus } =
    useGroupRescindMutation();
  const { mutate: rejectMutation, status: rejectStatus } =
    useGroupRejectMutation();
  const { mutate: sawRopeMutation } = useSawRopeMutation();

  const open = useCallback(() => {
    if (flag === '~nibset-napwyn/tlon') {
      return navigateByApp(
        '/groups/~nibset-napwyn/tlon/channels/chat/~nibset-napwyn/support'
      );
    }

    if (group) {
      return navigateByApp(`/groups/${flag}`);
    }

    return navigate(`/gangs/${flag}`, {
      state: { backgroundLocation: location },
    });
  }, [flag, group, location, navigate, navigateByApp]);

  const join = useCallback(async () => {
    if (privacy === 'private' && !invited) {
      knockMutation({ flag });
    } else {
      try {
        sawRopeMutation({
          rope: {
            channel: null,
            desk: window.desk,
            group: flag,
            thread: `/${flag}/invite`,
          },
        });
      } catch (error) {
        // no notification
      }

      try {
        joinMutation({ flag });
        if (redirectItem) {
          if (redirectItem.type === 'chat') {
            return navigateByApp(
              `/groups/${flag}/channels/${redirectItem.nest}?msg=${redirectItem.id}`
            );
          }
          return navigateByApp(
            `/groups/${flag}/channels/${redirectItem.nest}/${redirectItem.type}/${redirectItem.id}`
          );
        }
        return navigateByApp(`/groups/${flag}`);
      } catch (e) {
        if (requested) {
          rescindMutation({ flag });
        } else {
          rejectMutation({ flag });
        }
        return navigateByApp(`/find/${flag}`);
      }
    }
    return null;
  }, [
    privacy,
    invited,
    flag,
    requested,
    redirectItem,
    navigateByApp,
    joinMutation,
    knockMutation,
    rescindMutation,
    rejectMutation,
    sawRopeMutation,
  ]);

  const reject = useCallback(async () => {
    /**
     * No need to confirm if the group is public, since it's easy to re-initiate
     * a join request
     */
    if (privacy === 'public') {
      try {
        rejectMutation({ flag });
      } catch (e) {
        console.log('Failed to reject invite', e);
      }

      if (inModal) {
        dismiss();
      }
      return;
    }
    if (inModal) {
      modalNavigate(`/gangs/${flag}/reject`, {
        state: { backgroundLocation: location },
      });
    } else {
      navigateByApp(`/gangs/${flag}/reject`);
    }
  }, [
    flag,
    inModal,
    location,
    dismiss,
    modalNavigate,
    privacy,
    navigateByApp,
    rejectMutation,
  ]);

  return {
    group,
    privacy,
    requested,
    dismiss,
    open,
    join,
    status,
    rejectStatus,
    knockStatus,
    rescindStatus,
    reject,
    button: {
      disabled: requested && !invited,
      text: getButtonText(privacy, requested, !!invited, !!group),
      action: group ? open : join,
    },
  };
}
