import React, { useCallback } from 'react';
import { useNavigate } from 'react-router';

import Dialog, { DialogClose } from '@/components/Dialog';
import { useDismissNavigate } from '@/logic/routing';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import {
  useGroup,
  useGroupLeaveMutation,
  useRouteGroup,
} from '@/state/groups/groups';

export default function GroupInviteDialog() {
  const dismiss = useDismissNavigate();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const { privacy } = useGroupPrivacy(flag);
  const navigate = useNavigate();
  const { mutate: leaveGroupMutation } = useGroupLeaveMutation();

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  const onLeave = useCallback(async () => {
    leaveGroupMutation({ flag, privacy });
    navigate('/');
  }, [flag, privacy, navigate, leaveGroupMutation]);

  return (
    <Dialog
      defaultOpen
      onOpenChange={onOpenChange}
      containerClass="w-full max-w-lg"
      close="none"
    >
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
    </Dialog>
  );
}
