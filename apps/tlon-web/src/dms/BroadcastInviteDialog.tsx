import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

import Dialog from '../components/Dialog';
import ShipSelector, { ShipOption } from '../components/ShipSelector';
import { modifyCohort, useCohort } from '@/state/broadcasts';
import { stringToTa } from '@/logic/utils';

interface BroadcastInviteDialogProps {
  inviteIsOpen: boolean;
  setInviteIsOpen: (open: boolean) => void;
  whom?: string;
  mode: 'add' | 'del';
  create: boolean;
}

export default function BroadcastInviteDialog({
  inviteIsOpen,
  setInviteIsOpen,
  whom,
  mode = 'add',
  create = false,
}: BroadcastInviteDialogProps) {
  const navigate = useNavigate();
  const [ships, setShips] = useState<ShipOption[]>([]);
  const targets = useCohort(whom || '').targets; //NOTE '' stubs out
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
  const [nameValue, setNameValue] = useState('');

  const onEnter = useCallback(async () => {
    navigate(`/dm/broadcasts/${whom}`);
  }, [navigate, whom]);

  const submitHandler = useCallback(async () => {
    if (showError) return;
    const ta = whom ? whom : stringToTa(nameValue);
    const targets = ships.map((so) => so.value);
    const after = () => {
      navigate(`/dm/broadcasts/${ta}`);
      setInviteIsOpen(false);
      setNameValue('');
      setShips([]);
    };
    modifyCohort(ta, create || mode === 'add', targets, after);
  }, [nameValue, create, whom, showError, ships, navigate, mode, setInviteIsOpen]);

  return (
    <Dialog
      open={inviteIsOpen}
      onOpenChange={setInviteIsOpen}
      containerClass="w-full sm:max-w-xl overflow-visible"
      className="mb-64 bg-transparent p-0"
    >
      <div className="card">
        <div className="mb-4 flex flex-col space-y-4">
          <h2 className="text-lg font-bold">Add to Broadcast</h2>
          {create ? (<input
            autoFocus
            type="text"
            placeholder="Cohort Name"
            value={nameValue}
            onChange={(e)=>setNameValue(e.target.value)}
            className="input alt-highlight w-full border-gray-200 bg-transparent text-lg font-semibold focus:bg-transparent"
          />) : null}
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
              {invalidShips.length > 1 ? 'are' : 'is'} {mode === 'add' ? 'already' : 'not'} in this chat.
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-2">
          <button
            className="secondary-button"
            onClick={() => { setInviteIsOpen(false); setShips([]); }}
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
