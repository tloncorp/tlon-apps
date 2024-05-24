import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

import Dialog from '../components/Dialog';
import ShipSelector, { ShipOption } from '../components/ShipSelector';
import { useCohort, useCohorts } from '@/state/broadcasts';
import api from '@/api';

interface BroadcastInviteDialogProps {
  inviteIsOpen: boolean;
  setInviteIsOpen: (open: boolean) => void;
  whom: string;
  mode: 'add' | 'del';
}

export default function BroadcastInviteDialog({
  inviteIsOpen,
  setInviteIsOpen,
  whom,
  mode = 'add',
}: BroadcastInviteDialogProps) {
  const navigate = useNavigate();
  //TODO  need to clear ships after activation/unmount/navigation
  const [ships, setShips] = useState<ShipOption[]>([]);
  const targets = useCohort(whom).targets;
  const { refetch: refetchCohorts } = useCohorts();
  const invalidShips = ships.filter((ship) => {
    if (!targets) {
      return false;
    }
    if (mode === 'add') {
      return targets.includes(ship.value);
    } else {
      return !targets.includes(ship.value);
    }
  });
  const showError = invalidShips.length > 0;

  const onEnter = useCallback(async () => {
    navigate(`/broadcasts/${whom}`);
  }, [navigate, whom]);

  const submitHandler = useCallback(async () => {
    if (whom && !showError) {
      let json;
      if (mode === 'add') {
        json = {
          'add-cohort': {
            cohort: whom,
              targets: ships.map((so) => {
                return so.value;
              })
          }
        };
      } else {
        json = {
          'del-cohort': {
            cohort: whom,
              targets: ships.map((so) => {
                return so.value;
              })
          }
        };
      }
      //TODO  refetch just this specific cohort
      api.poke({
        mark: 'broadcaster-action', app: 'broadcaster', json,
        onSuccess: refetchCohorts, onError: refetchCohorts
      });
      setInviteIsOpen(false);
    }
  }, [mode, whom, showError, ships, refetchCohorts, setInviteIsOpen]);

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
            {mode === 'add' ? 'Add' : 'Remove'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
