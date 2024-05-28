import { Gang, Group, PrivacyType } from '@tloncorp/shared/dist/urbit/groups';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useNavWithinTab } from '@/components/Sidebar/util';
import { useDismissNavigate, useModalNavigate } from '@/logic/routing';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import {
  groupIsInitializing,
  useGroup,
  useGroupJoinMutation,
  useGroupKnockMutation,
  useGroupRejectMutation,
  useGroupRescindMutation,
} from '@/state/groups';
import { useSawRopeMutation } from '@/state/hark';
import { useNewGroupFlags, usePutEntryMutation } from '@/state/settings';

function getButtonText(
  privacy: PrivacyType,
  requested: boolean,
  invited: boolean,
  group?: Group
) {
  switch (true) {
    case group && !!group.meta?.title:
      return 'Go';
    case requested && !invited:
      return 'Requested';
    case privacy === 'private' && !invited:
      return 'Request to Join';
    default:
      return 'Join Group';
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
  const { navigate } = useNavWithinTab();
  const modalIsOpen =
    !!location.state?.backgroundLocation &&
    location.pathname.includes('gangs/');
  const modalNavigate = useModalNavigate();
  const dismiss = useDismissNavigate();
  const group = useGroup(flag, false);
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
  const newGroupFlags = useNewGroupFlags();
  const [newlyJoined, setNewlyJoined] = useState(false);
  const { mutate: setNewGroupFlags } = usePutEntryMutation({
    bucket: 'groups',
    key: 'newGroupFlags',
  });

  const open = useCallback(() => {
    if (group && !groupIsInitializing(group)) {
      return navigate(`/groups/${flag}`);
    }

    return navigate(`/gangs/${flag}`, true);
  }, [flag, group, location, navigate]);

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
        joinMutation({ flag, privacy });
        setNewlyJoined(true);
        if (!newGroupFlags.includes(flag)) {
          setNewGroupFlags({ val: [...newGroupFlags, flag] });
        }
      } catch (e) {
        if (requested) {
          rescindMutation({ flag });
        } else {
          rejectMutation({ flag });
        }
        return navigate(`/find/${flag}`);
      }
    }
    return null;
  }, [
    privacy,
    invited,
    flag,
    requested,
    navigate,
    joinMutation,
    knockMutation,
    rescindMutation,
    rejectMutation,
    sawRopeMutation,
    newGroupFlags,
    setNewGroupFlags,
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
      navigate(`/gangs/${flag}/reject`, true);
    } else {
      navigate(`/gangs/${flag}/reject`);
    }
  }, [
    flag,
    inModal,
    location,
    dismiss,
    modalNavigate,
    privacy,
    navigate,
    rejectMutation,
  ]);

  useEffect(() => {
    if (group && modalIsOpen && !inModal) {
      if (redirectItem) {
        if (redirectItem.type === 'chat') {
          navigate(
            `/groups/${flag}/channels/${redirectItem.nest}?msg=${redirectItem.id}`
          );
        } else {
          navigate(
            `/groups/${flag}/channels/${redirectItem.nest}/${redirectItem.type}/${redirectItem.id}`
          );
        }
      } else {
        navigate(`/groups/${flag}`);
      }
    }
  }, [group, navigate, flag, redirectItem, modalIsOpen, inModal]);

  return {
    group,
    privacy,
    requested,
    dismiss,
    open,
    join,
    newlyJoined,
    status,
    rejectStatus,
    knockStatus,
    rescindStatus,
    reject,
    button: {
      disabled: requested && !invited,
      text: getButtonText(privacy, requested, !!invited, group),
      action: group ? open : join,
    },
  };
}
