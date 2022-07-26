import React, { useCallback } from 'react';
import Dialog, { DialogClose, DialogContent } from '@/components/Dialog';
import { useDismissNavigate } from '@/logic/routing';
import { useGroupState, useRouteGroup } from '@/state/groups/groups';

const { ship } = window;

export default function GroupInviteDialog() {
  const dismiss = useDismissNavigate();
  const flag = useRouteGroup();

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  const onLeave = useCallback(() => {
    useGroupState.getState().leave(flag);
  }, [flag]);

  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogContent containerClass="w-full max-w-lg" showClose>
        <div className="flex flex-col">
          <h2 className="mb-4 text-lg font-bold">Leave Group</h2>
          <div className="w-full py-3">
            {flag.includes(ship) ? (
              <span className="text-sm font-semibold">
                You cannot leave a group that you host. You should delete the
                group instead
              </span>
            ) : (
              <span className="text-sm font-semibold">
                Do you really want to leave {flag}?
              </span>
            )}
          </div>
          <div className="flex items-center justify-end space-x-2">
            <DialogClose className="secondary-button">Cancel</DialogClose>
            {flag.includes(ship) ? null : (
              <DialogClose
                onClick={onLeave}
                className="button bg-blue text-white dark:text-black"
              >
                Leave
              </DialogClose>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
