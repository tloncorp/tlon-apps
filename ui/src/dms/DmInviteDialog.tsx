import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import ob from 'urbit-ob';
import Dialog, { DialogContent } from '../components/Dialog';
import { whomIsMultiDm } from '../logic/utils';
import { useChatState } from '../state/chat';
import DMInviteInput, { Option } from './DMInviteInput';

interface DmInviteDialogProps {
  inviteIsOpen: boolean;
  setInviteIsOpen: (open: boolean) => void;
}

export default function DmInviteDialog({
  inviteIsOpen,
  setInviteIsOpen,
}: DmInviteDialogProps) {
  // TODO: out of scope for #259; a sketch for #260
  // requires passing singular ship into DMInviteInput, instead of multiple,
  // since inviteToMultiDm expects a single `for`

  const navigate = useNavigate();
  const whom = useParams<{ ship: string }>().ship;
  const fromMulti = whom ? whomIsMultiDm(whom) : false;
  const clubId = fromMulti ? whom : undefined;
  const [ships, setShips] = useState<Option[]>([]);
  const validShips = ships
    ? ships.every((ship) => ob.isValidPatp(ship.value))
    : false;

  const submitHandler = async () => {
    // if (clubId && validShips) {
    //   await useChatState.getState().inviteToMultiDm(clubId,
    //     { by: window.our, for: ship, ships.map((s) => s.value))
    //   navigate(`/dm/${clubId}`);
    // }
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
                clubId={clubId}
                fromMulti={fromMulti}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <button className="secondary-button">Cancel</button>
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
