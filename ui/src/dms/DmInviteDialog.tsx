import React, { useState } from 'react';
import Dialog, { DialogContent } from '../components/Dialog';
import DMInviteInput, { Option } from './DMInviteInput';

interface DmInviteDialogProps {
  inviteIsOpen: boolean;
  setInviteIsOpen: (open: boolean) => void;
}

export default function DmInviteDialog({
  inviteIsOpen,
  setInviteIsOpen,
}: DmInviteDialogProps) {
  const [ships, setShips] = useState<Option[] | undefined>();

  return (
    <Dialog open={inviteIsOpen} onOpenChange={setInviteIsOpen}>
      <DialogContent containerClass="w-full sm:max-w-lg" showClose>
        <div className="flex flex-col">
          <h2 className="mb-4 text-lg font-bold">Invite to Chat</h2>
          <div className="w-full py-3 px-4">
            <DMInviteInput ships={ships} setShips={setShips} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
