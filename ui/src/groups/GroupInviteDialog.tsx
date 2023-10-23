import ob from 'urbit-ob';
import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import Dialog, { DialogClose } from '@/components/Dialog';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { useDismissNavigate } from '@/logic/routing';
import {
  useGroup,
  useGroupAddMembersMutation,
  useGroupCompatibility,
  useGroupInviteMutation,
  useRouteGroup,
} from '@/state/groups/groups';
import { useIsMobile } from '@/logic/useMedia';
import { getFlagParts, getPrivacyFromGroup, preSig } from '@/logic/utils';
import Sheet, { SheetContent } from '@/components/Sheet';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import HostConnection from '@/channels/HostConnection';
import { useConnectivityCheck } from '@/state/vitals';
import WidgetDrawer from '@/components/WidgetDrawer';
import { motion } from 'framer-motion';
import LureInviteBlock from './LureInviteBlock';

export function GroupInviteBlock({
  onFocusChange,
  menuPlacement,
  maxMenuHeight,
}: {
  onFocusChange?: (b: boolean) => void;
  menuPlacement?: 'top' | 'bottom';
  maxMenuHeight?: number;
}) {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const host = getFlagParts(flag).ship;
  const { data } = useConnectivityCheck(host);
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
  const { compatible } = useGroupCompatibility(flag);
  const hasIssue =
    !compatible ||
    (data?.status &&
      'complete' in data.status &&
      data.status.complete !== 'yes');

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
      <h2 className="text-xl">Invite via Urbit ID</h2>
      {hasIssue && (
        <HostConnection
          type="combo"
          className="mb-4 text-sm"
          ship={host}
          status={data?.status}
          saga={group?.saga || null}
        />
      )}
      <div className="w-full py-3">
        <ShipSelector
          ships={ships}
          setShips={setShips}
          onEnter={onInvite}
          placeholder="Search for Urbit ID"
          autoFocus={false}
          onFocusChange={onFocusChange}
          menuPlacement={menuPlacement}
          maxMenuHeight={maxMenuHeight}
        />
      </div>
      <div className="flex items-center justify-end space-x-2">
        <DialogClose className="secondary-button">Cancel</DialogClose>
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
  const [inputFocused, setInputFocused] = useState(false);
  const dismiss = useDismissNavigate();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const isMobile = useIsMobile();

  return isMobile ? (
    <WidgetDrawer
      open={true}
      onOpenChange={(o) => !o && dismiss()}
      className="!h-[70vh] px-10 py-6"
    >
      <div className="space-y-6">
        {group ? (
          <>
            {!inputFocused && (
              <>
                <div>
                  <h2 className="text-xl">Share Group</h2>
                  <h3 className="text-[17px] text-gray-500">
                    {group.meta.title}
                  </h3>
                </div>
                <LureInviteBlock flag={flag} group={group} />
              </>
            )}
            <motion.div layout transition={{ duration: 0.1 }}>
              <GroupInviteBlock
                onFocusChange={setInputFocused}
                menuPlacement="bottom"
                maxMenuHeight={200}
              />
            </motion.div>
          </>
        ) : null}
      </div>
    </WidgetDrawer>
  ) : (
    <Dialog
      open={true}
      onOpenChange={(isOpen) => !isOpen && dismiss()}
      containerClass="w-[400px] max-w-xl card"
      className="bg-transparent p-0"
      close="none"
    >
      <div className="space-y-6">
        {group ? (
          <>
            <div>
              <h2 className="text-xl">Share Group</h2>
              <h3 className="text-[17px] text-gray-500">{group.meta.title}</h3>
            </div>
            <LureInviteBlock flag={flag} group={group} />
            <GroupInviteBlock />
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
