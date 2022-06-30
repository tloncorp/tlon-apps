import ob from 'urbit-ob';
import React, { useCallback, useState } from 'react';
import Dialog, { DialogClose, DialogContent } from '../components/Dialog';
import ShipSelector, { Option } from '../dms/ShipSelector';
import { useDismissNavigate } from '../logic/routing';
import { useGroupState, useRouteGroup } from '../state/groups/groups';

export default function GroupInviteDialog() {
  const dismiss = useDismissNavigate();
  const flag = useRouteGroup();
  const [ships, setShips] = useState<Option[]>([]);
  const validShips = ships
    ? ships.every((ship) => ob.isValidPatp(ship.value))
    : false;

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  const onInvite = useCallback(() => {
    useGroupState.getState().addMembers(
      flag,
      ships.map((s) => s.value)
    );
  }, [flag, ships]);

  const onEnter = useCallback(() => {
    onInvite();
    dismiss();
  }, [onInvite, dismiss]);

  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogContent containerClass="w-full max-w-lg" showClose>
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
