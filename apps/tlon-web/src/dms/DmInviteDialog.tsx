import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

import Dialog from '../components/Dialog';
import ShipSelector, { ShipOption } from '../components/ShipSelector';
import { useInviteToMultiDm, useMultiDm } from '../state/chat';

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
  const club = useMultiDm(whom);
  const { mutateAsync: inviteToMultiDm } = useInviteToMultiDm();
  const invalidShips = ships.filter((ship) => {
    if (!club) {
      return false;
    }

    const members = [...club.hive, ...club.team];
    return members.includes(ship.value);
  });
  const showError = invalidShips.length > 0;

  const onEnter = useCallback(async () => {
    navigate(`/dm/${whom}`);
  }, [navigate, whom]);

  const submitHandler = useCallback(async () => {
    if (whom && !showError) {
      ships.map(async (ship) => {
        await inviteToMultiDm({
          id: whom,
          hive: {
            by: window.our,
            for: ship.value,
          },
        });
      });
      setInviteIsOpen(false);
    }
  }, [whom, showError, ships, setInviteIsOpen, inviteToMultiDm]);

  return (
    <Dialog
      open={inviteIsOpen}
      onOpenChange={setInviteIsOpen}
      containerClass="w-full sm:max-w-xl overflow-visible"
      className="mb-64 bg-transparent p-0"
    >
      <div className="card">
        <div className="mb-4 flex flex-col space-y-4">
          <h2 className="text-lg font-bold">Invite to Chat</h2>
          <ShipSelector ships={ships} setShips={setShips} onEnter={onEnter} />
          {showError && (
            <div className="text-red">
              {invalidShips.map((s, i) => {
                if (i === invalidShips.length - 1) {
                  return (
                    <>
                      {invalidShips.length > 1 ? 'and ' : ''}
                      <strong>{s.label || s.value}</strong>{' '}
                    </>
                  );
                }

                return (
                  <>
                    <strong>{s.label || s.value}</strong>
                    {`${invalidShips.length > 2 ? ',' : ''} `}
                  </>
                );
              })}
              {invalidShips.length > 1 ? 'are' : 'is'} already in this chat.
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-2">
          <button
            className="secondary-button"
            onClick={() => setInviteIsOpen(false)}
          >
            Cancel
          </button>
          <button
            disabled={showError}
            className="button"
            onClick={submitHandler}
          >
            Invite
          </button>
        </div>
      </div>
    </Dialog>
  );
}
