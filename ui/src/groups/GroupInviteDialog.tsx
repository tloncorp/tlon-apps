import ob from 'urbit-ob';
import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import Dialog, { DialogContent } from '@/components/Dialog';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { useDismissNavigate } from '@/logic/routing';
import { useGroup, useGroupState, useRouteGroup } from '@/state/groups/groups';
import { getPrivacyFromGroup, preSig } from '@/logic/utils';
import useRequestState from '@/logic/useRequestState';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ExclamationPoint from '@/components/icons/ExclamationPoint';

export default function GroupInviteDialog() {
  const [open, setOpen] = useState(true);
  const dismiss = useDismissNavigate();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const privacy = group ? getPrivacyFromGroup(group) : 'public';
  const [ships, setShips] = useState<ShipOption[]>([]);
  const validShips = ships
    ? ships.every((ship) => ob.isValidPatp(preSig(ship.value)))
    : false;
  const { isPending, setPending, setReady, setFailed, isFailed } =
    useRequestState();

  const close = useCallback(() => {
    setOpen(false);
    dismiss();
  }, [dismiss]);

  const onInvite = useCallback(async () => {
    setPending();
    const shipList = ships.map((s) => preSig(s.value));
    if (privacy === 'public') {
      try {
        await useGroupState.getState().addMembers(flag, shipList);
        setReady();
        close();
      } catch (e) {
        console.error('Error adding members: poke failed');
        setFailed();
        setTimeout(() => {
          setReady();
        }, 3000);
      }
    } else {
      try {
        await useGroupState.getState().invite(flag, shipList);
        setReady();
        close();
      } catch (e) {
        console.error('Error inviting members: poke failed');
        setFailed();
        setTimeout(() => {
          setReady();
        }, 3000);
      }
    }
  }, [flag, privacy, ships, setPending, setReady, setFailed, close]);

  const onEnter = useCallback(() => {
    onInvite();
    close();
  }, [onInvite, close]);

  return (
    <Dialog open={open}>
      <DialogContent containerClass="w-full max-w-xl" showClose={false}>
        <div className="flex flex-col">
          <h2 className="mb-4 text-lg font-bold">Invite To Group</h2>
          <div className="w-full py-3">
            <ShipSelector ships={ships} setShips={setShips} onEnter={onEnter} />
          </div>
          <div className="flex items-center justify-end space-x-2">
            <button className="secondary-button" onClick={close}>
              Cancel
            </button>

            <button
              onClick={onInvite}
              className={cn('button text-white dark:text-black', {
                'bg-red': isFailed,
                'bg-blue': !isFailed,
              })}
              disabled={!validShips || isPending || isFailed}
            >
              Invite
              {isPending ? <LoadingSpinner className="ml-2 h-4 w-4" /> : null}
              {isFailed ? <ExclamationPoint className="ml-2 h-4 w-4" /> : null}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
