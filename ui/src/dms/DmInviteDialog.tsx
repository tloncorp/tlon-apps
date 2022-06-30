import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import ob from 'urbit-ob';
import Dialog, { DialogContent } from '../components/Dialog';
import { useChatState } from '../state/chat';
import DMInviteInput, { ShipOption } from './DMInviteInput';

interface DmInviteDialogProps {
  inviteIsOpen: boolean;
  setInviteIsOpen: (open: boolean) => void;
  whom: string;
}

export default function DmInviteDialog({
  inviteIsOpen,
  setInviteIsOpen,
  whom,
}: DmInviteDialogProps) {
  const navigate = useNavigate();
  const [ships, setShips] = useState<ShipOption[]>([]);
  const validShips = ships
    ? ships.every((ship) => ob.isValidPatp(ship.value))
    : false;

  const submitHandler = async () => {
    if (whom && validShips) {
      ships.map(async (ship) => {
        await useChatState.getState().inviteToMultiDm(whom, {
          by: window.our,
          for: ship.value,
        });
      });
      setInviteIsOpen(false);
    }
  };

  return (
    <Dialog open={inviteIsOpen} onOpenChange={setInviteIsOpen}>
      <DialogContent containerClass="w-full sm:max-w-lg" showClose>
        <div>
          <div className="flex flex-col">
            <h2 className="mb-4 text-lg font-bold">Invite to Chat</h2>
            <div className="w-full py-3 px-4">
              <DMInviteInput
                ships={ships}
                setShips={setShips}
                clubId={whom}
                fromMulti
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              className="secondary-button"
              onClick={() => setInviteIsOpen(false)}
            >
              Cancel
            </button>
            <button
              disabled={!validShips}
              className="button"
              onClick={submitHandler}
            >
              Add
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
