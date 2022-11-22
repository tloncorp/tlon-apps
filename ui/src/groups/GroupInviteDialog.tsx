import ob from 'urbit-ob';
import React, { useCallback, useState } from 'react';
import Dialog, { DialogClose, DialogContent } from '@/components/Dialog';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { useDismissNavigate } from '@/logic/routing';
import { useGroup, useGroupState, useRouteGroup } from '@/state/groups/groups';
import { getPrivacyFromGroup, preSig } from '@/logic/utils';

export default function GroupInviteDialog() {
  const dismiss = useDismissNavigate();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const privacy = group ? getPrivacyFromGroup(group) : 'public';
  const [ships, setShips] = useState<ShipOption[]>([]);
  const validShips = ships
    ? ships.every((ship) => ob.isValidPatp(preSig(ship.value)))
    : false;

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  const onInvite = useCallback(() => {
    const shipList = ships.map((s) => preSig(s.value));
    if (privacy === 'public') {
      useGroupState.getState().addMembers(flag, shipList);
    } else {
      useGroupState.getState().invite(flag, shipList);
    }
  }, [flag, privacy, ships]);

  const onEnter = useCallback(() => {
    onInvite();
    dismiss();
  }, [onInvite, dismiss]);

  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogContent containerClass="w-full max-w-xl" showClose>
        <div className="flex flex-col">
          <h2 className="mb-4 text-lg font-bold">Invite To Group</h2>
          <div className="w-full py-3">
            <ShipSelector ships={ships} setShips={setShips} onEnter={onEnter} />
          </div>
          <div className="flex items-center justify-end space-x-2">
            <DialogClose className="secondary-button">Cancel</DialogClose>

            <DialogClose
              onClick={onInvite}
              className="button bg-blue text-white dark:text-black"
              disabled={!validShips}
            >
              Invite
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
