import cn from 'classnames';
import React, { useCallback } from 'react';
import { useLocation } from 'react-router';

import Avatar from '@/components/Avatar';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ShipName from '@/components/ShipName';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import { getChannelHosts } from '@/logic/channel';
import { useModalNavigate } from '@/logic/routing';
import { useContact } from '@/state/contact';
import {
  useGroup,
  useGroupFlag,
  useGroupInviteMutation,
  useGroupRevokeMutation,
} from '@/state/groups';

interface PendingMemberItemProps {
  member: string;
}

function PendingMemberItem({ member }: PendingMemberItemProps) {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const contact = useContact(member);
  const location = useLocation();
  const modalNavigate = useModalNavigate();

  const onViewProfile = (ship: string) => {
    modalNavigate(`/profile/${ship}`, {
      state: { backgroundLocation: location },
    });
  };

  const {
    mutate: revokeMutation,
    status: revokeStatus,
    reset: resetRevoke,
  } = useGroupRevokeMutation();
  const {
    mutate: inviteMutation,
    status: joinStatus,
    reset: resetInvite,
  } = useGroupInviteMutation();

  const reject = useCallback(
    (ship: string, kind: 'ask' | 'pending') => async () => {
      try {
        revokeMutation({ flag, ships: [ship], kind });
      } catch (e) {
        console.error('Error revoking invite, poke failed');
        setTimeout(() => {
          resetRevoke();
        }, 3000);
      }
    },
    [flag, revokeMutation, resetRevoke]
  );

  const approve = useCallback(
    (ship: string) => async () => {
      try {
        inviteMutation({ flag, ships: [ship] });
      } catch (e) {
        console.error('Error approving invite, poke failed');
        setTimeout(() => {
          resetInvite();
        }, 3000);
      }
    },
    [flag, inviteMutation, resetInvite]
  );

  if (!group) {
    return null;
  }

  const isHost = getChannelHosts(group).includes(member);

  const inAsk =
    'shut' in group.cordon && group.cordon.shut.ask.includes(member);
  const inPending =
    'shut' in group.cordon && group.cordon.shut.pending.includes(member);

  return (
    <>
      <div className="cursor-pointer" onClick={() => onViewProfile(member)}>
        <Avatar ship={member} size="small" icon={false} className="mr-2" />
      </div>
      <div className="flex flex-1 flex-col space-y-0.5">
        <h2>
          {contact?.nickname ? contact.nickname : <ShipName name={member} />}
        </h2>
        {contact?.nickname ? (
          <p className="text-sm text-gray-400">{member}</p>
        ) : null}
      </div>

      <div className="flex items-center space-x-3">
        {inAsk || inPending ? (
          <button
            className={cn('small-button', {
              'bg-red text-white': revokeStatus === 'error',
            })}
            onClick={reject(member, inAsk ? 'ask' : 'pending')}
            disabled={revokeStatus === 'loading' || revokeStatus === 'error'}
          >
            {inAsk ? 'Reject' : 'Revoke'}
            {revokeStatus === 'loading' ? (
              <LoadingSpinner className="ml-2 h-3 w-3" />
            ) : null}
            {revokeStatus === 'error' ? (
              <ExclamationPoint className="ml-2 h-3 w-3" />
            ) : null}
          </button>
        ) : null}
        <button
          disabled={
            !inAsk || joinStatus === 'loading' || joinStatus === 'error'
          }
          className={cn(
            'small-button text-white disabled:bg-gray-100 disabled:text-gray-600 dark:text-black dark:disabled:text-gray-600',
            {
              'bg-red': joinStatus === 'error',
              'bg-blue': joinStatus !== 'error',
            }
          )}
          onClick={approve(member)}
        >
          {inAsk ? 'Approve' : 'Invited'}
          {joinStatus === 'loading' ? (
            <LoadingSpinner className="ml-2 h-3 w-3" />
          ) : null}
          {joinStatus === 'error' ? (
            <ExclamationPoint className="ml-2 h-3 w-3" />
          ) : null}
        </button>
      </div>
    </>
  );
}

export default React.memo(PendingMemberItem);
