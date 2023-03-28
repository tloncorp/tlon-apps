import ob from 'urbit-ob';
import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import Dialog, { DialogClose } from '@/components/Dialog';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { useDismissNavigate } from '@/logic/routing';
import { useGroup, useGroupState, useRouteGroup } from '@/state/groups/groups';
import { getPrivacyFromGroup, preSig } from '@/logic/utils';
import useRequestState from '@/logic/useRequestState';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import LureInviteBlock from './LureInviteBlock';

export default function GroupInviteDialog() {
  const dismiss = useDismissNavigate();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const privacy = group ? getPrivacyFromGroup(group) : 'public';
  const [ships, setShips] = useState<ShipOption[]>([]);
  const validShips =
    ships && ships.length > 0
      ? ships.every((ship) => ob.isValidPatp(preSig(ship.value)))
      : false;
  const { isPending, setPending, setReady, setFailed, isFailed } =
    useRequestState();

  const onInvite = useCallback(async () => {
    setPending();
    const shipList = ships.map((s) => preSig(s.value));

    try {
      if (privacy !== 'public') {
        await useGroupState.getState().invite(flag, shipList);
      } else {
        await useGroupState.getState().addMembers(flag, shipList);
      }
      setReady();
      dismiss();
    } catch (e) {
      console.error('Error inviting/adding members: poke failed');
      setFailed();
      setTimeout(() => {
        setReady();
      }, 3000);
    }
  }, [flag, privacy, ships, setPending, setReady, setFailed, dismiss]);

  return (
    <Dialog
      open={true}
      onOpenChange={(isOpen) => !isOpen && dismiss()}
      containerClass="w-full max-w-xl"
      className="bg-transparent p-0"
      close="none"
    >
      <div className="flex flex-col space-y-6">
        <LureInviteBlock flag={flag} group={group} />
        <div className="card">
          <h2 className="mb-1 text-lg font-bold">Invite by Urbit ID</h2>
          <p className="mb-4 text-gray-600">
            (e.g. ~sampel-palnet) or display name.
          </p>
          <div className="w-full py-3">
            <ShipSelector
              ships={ships}
              setShips={setShips}
              onEnter={onInvite}
              placeholder="Search"
            />
          </div>
          <div className="flex items-center justify-end space-x-2">
            <DialogClose className="secondary-button">Cancel</DialogClose>

            <button
              onClick={onInvite}
              className={cn('button text-white dark:text-black', {
                'bg-red': isFailed,
                'bg-blue': !isFailed,
              })}
              disabled={!validShips || isPending || isFailed}
            >
              Send Invites
              {isPending ? <LoadingSpinner className="ml-2 h-4 w-4" /> : null}
              {isFailed ? <ExclamationPoint className="ml-2 h-4 w-4" /> : null}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
