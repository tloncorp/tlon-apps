import React, { useCallback } from 'react';
import Dialog, { DialogContent } from '../Dialog';

interface GroupInviteDialogProps {
  flag: string;
  onClose: (
    e:
      | React.MouseEvent<HTMLDivElement, MouseEvent>
      | React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export default function GroupInviteDialog({
  flag,
  onClose,
  onOpenChange,
  open,
}: GroupInviteDialogProps) {
  const onInvite = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => onClose(e),
    [onClose]
  ); // TODO: invite poke

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent containerClass="max-w-md" showClose>
        <div className="flex flex-col">
          <h2 className="mb-4 text-lg font-bold">Invite To Group</h2>
          <p className="mb-7 leading-5">Enter a username to invite to {flag}</p>
          <div className="flex items-center justify-end space-x-2">
            <button onClick={onClose} className="button" type="button">
              Cancel
            </button>

            <button
              onClick={onInvite}
              className="button bg-blue text-white"
              type="button"
            >
              Invite
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
