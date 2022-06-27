import React, { useCallback } from 'react';
import Dialog, { DialogClose, DialogContent } from '../components/Dialog';
import { useDismissNavigate } from '../logic/routing';
import { useRouteGroup } from '../state/groups';

export default function GroupInviteDialog() {
  const dismiss = useDismissNavigate();
  const flag = useRouteGroup();

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  const onInvite = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => null,
    []
  ); // TODO: invite poke

  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogContent containerClass="max-w-md" showClose>
        <div className="flex flex-col">
          <h2 className="mb-4 text-lg font-bold">Invite To Group</h2>
          <p className="mb-7 leading-5">Enter a username to invite to {flag}</p>
          <div className="flex items-center justify-end space-x-2">
            <DialogClose className="button" type="button">
              Cancel
            </DialogClose>

            <DialogClose
              onClick={onInvite}
              className="button bg-blue text-white"
            >
              Invite
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
