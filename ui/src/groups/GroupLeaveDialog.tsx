import React, { useCallback } from 'react';
import Dialog, { DialogClose, DialogContent } from '@/components/Dialog';
import { useDismissNavigate } from '@/logic/routing';
import { useGroupState, useRouteGroup, useGroup } from '@/state/groups/groups';
import { useNavigate } from 'react-router';

export default function GroupInviteDialog() {
  const dismiss = useDismissNavigate();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const navigate = useNavigate();

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  const onLeave = useCallback(async () => {
    await useGroupState.getState().leave(flag);
    navigate('/');
  }, [flag, navigate]);

  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogContent containerClass="w-full max-w-lg" showClose={false}>
        <div className="flex flex-col">
          <h2 className="text-lg font-bold">Leave Group</h2>
          <div className="w-full py-6">
            Do you really want to leave{' '}
            <span className="font-semibold">{group?.meta.title}</span>?
          </div>
          <div className="flex items-center justify-end space-x-2">
            <DialogClose className="secondary-button">Cancel</DialogClose>
            <DialogClose
              onClick={onLeave}
              className="button bg-red text-white dark:text-black"
            >
              Leave
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
