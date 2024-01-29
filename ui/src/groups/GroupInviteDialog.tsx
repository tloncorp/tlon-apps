import ob from 'urbit-ob';
import { useCallback, useState } from 'react';
import { useMatch } from 'react-router-dom';
import cn from 'classnames';
import Dialog, { DialogClose } from '@/components/Dialog';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { useDismissNavigate } from '@/logic/routing';
import {
  useGroup,
  useGroupAddMembersMutation,
  useGroupInviteMutation,
  useRouteGroup,
} from '@/state/groups/groups';
import { useIsMobile } from '@/logic/useMedia';
import { getPrivacyFromGroup, preSig } from '@/logic/utils';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import WidgetDrawer from '@/components/WidgetDrawer';
import LureInviteBlock from './LureInviteBlock';
import GroupHostConnection from './GroupHostConnection';

export function GroupInviteBlock() {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const privacy = group ? getPrivacyFromGroup(group) : 'public';
  const [ships, setShips] = useState<ShipOption[]>([]);
  const validShips =
    ships && ships.length > 0
      ? ships.every((ship) => ob.isValidPatp(preSig(ship.value)))
      : false;
  const {
    mutate: inviteMutation,
    status: inviteStatus,
    reset: resetInvite,
  } = useGroupInviteMutation();
  const {
    mutate: addMembersMutation,
    status: addMembersStatus,
    reset: resetAddMembers,
  } = useGroupAddMembersMutation();

  // Determine if we are in the "Invite People" dialog , which is different
  // than the "Invites & Privacy" section of Group Settings
  const isInviteDialog = useMatch('/groups/:ship/:name/invite');

  const onInvite = useCallback(async () => {
    const shipList = ships.map((s) => preSig(s.value));

    try {
      if (privacy !== 'public') {
        inviteMutation({ flag, ships: shipList });
      } else {
        addMembersMutation({ flag, ships: shipList });
      }
      setShips([]);
      setTimeout(() => {
        resetInvite();
        resetAddMembers();
      }, 3000);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error inviting/adding members: poke failed');
      setTimeout(() => {
        resetInvite();
        resetAddMembers();
      }, 3000);
    }
  }, [
    flag,
    privacy,
    ships,
    inviteMutation,
    addMembersMutation,
    resetInvite,
    resetAddMembers,
  ]);

  return (
    <div>
      <div className="my-3">
        <h2 className="mb-2 text-lg font-semibold">Invite via Urbit ID</h2>
        <p className="leading-5 text-gray-600">
          Invite people to your group who are already using Urbit.
        </p>
      </div>
      <GroupHostConnection
        type="combo"
        className="mb-4 text-sm"
        flag={flag}
        hideIfConnected
      />
      <div className="w-full">
        <ShipSelector
          ships={ships}
          setShips={setShips}
          onEnter={onInvite}
          placeholder="Search for Urbit ID"
          autoFocus={false}
        />
      </div>
      <div className="mt-3 flex items-center justify-end space-x-2">
        {isInviteDialog && (
          <DialogClose className="secondary-button">Cancel</DialogClose>
        )}

        {addMembersStatus === 'success' ? (
          <button disabled className="button">
            Invites Sent
          </button>
        ) : (
          <button
            onClick={onInvite}
            className={cn('button', {
              'bg-red':
                inviteStatus === 'error' || addMembersStatus === 'error',
            })}
            disabled={
              !validShips ||
              inviteStatus === 'loading' ||
              inviteStatus === 'error' ||
              addMembersStatus === 'loading' ||
              addMembersStatus === 'error'
            }
          >
            Send Invites
            {inviteStatus === 'loading' || addMembersStatus === 'loading' ? (
              <LoadingSpinner className="ml-2 h-4 w-4" />
            ) : null}
            {inviteStatus === 'error' || addMembersStatus === 'error' ? (
              <ExclamationPoint className="ml-2 h-4 w-4" />
            ) : null}
          </button>
        )}
      </div>
    </div>
  );
}

export default function GroupInviteDialog() {
  const dismiss = useDismissNavigate();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const isMobile = useIsMobile();

  function renderContent() {
    return (
      <div className="space-y-6">
        {group ? (
          <>
            <div className="text-lg leading-6">
              <div className="font-semibold text-gray-800">Share Group</div>
              <div className="font-normal text-gray-400">
                {group.meta.title}
              </div>
            </div>
            <LureInviteBlock flag={flag} group={group} />
            <GroupInviteBlock />
          </>
        ) : null}
      </div>
    );
  }

  return isMobile ? (
    <WidgetDrawer
      open={true}
      onOpenChange={(o) => !o && dismiss()}
      className="px-10 py-6"
    >
      {renderContent()}
    </WidgetDrawer>
  ) : (
    <Dialog
      open={true}
      onOpenChange={(isOpen) => !isOpen && dismiss()}
      containerClass="w-[400px] max-w-xl card"
      className="bg-transparent p-0"
      close="none"
    >
      {renderContent()}
    </Dialog>
  );
}
