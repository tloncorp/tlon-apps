import React from 'react';
import cn from 'classnames';
import { useLocation } from 'react-router';
import { useGang, useGroupState, useRouteGroup } from '../state/groups';
import { JoinProgress } from '../types/groups';
import GangName from '../components/GangName/GangName';
import GangPreview from '../components/GangPreview/GangPreview';
import { ModalLocationState, useDismissNavigate } from '../logic/routing';
import JoinGroup from '../components/JoinGroup';
import Dialog, { DialogContent } from '../components/Dialog';
import Avatar from '../components/Avatar';
import ShipName from '../components/ShipName';

function progressDescription(progress: JoinProgress) {
  switch (progress) {
    case 'adding':
      return 'Requesting membership';
    case 'watching':
      return 'Retrieving data';
    case 'done':
      return 'Join finished';
    case 'error':
      return 'Join errored unexpectedly';
    default:
      return '';
  }
}

function progressClass(progress: JoinProgress) {
  switch (progress) {
    case 'adding':
      return 'w-24';
    case 'watching':
      return 'w-48';
    case 'done':
      return 'w-72';
    case 'error':
      return 'w-72 bg-red-500';
    default:
      return '';
  }
}

export default function Gang() {
  const flag = useRouteGroup();
  const { invite, claim, preview } = useGang(flag);
  const onJoin = async () => {
    useGroupState.getState().join(flag, false);
  };
  return (
    <div className="flex flex-col space-y-4 p-4">
      {preview ? <GangPreview preview={preview} /> : null}

      {invite ? (
        <div className="flex flex-col space-y-3 rounded border p-2">
          <div className="flex items-center space-x-2">
            <Avatar ship={invite.ship} size="xs" />
            <p>
              <ShipName name={invite.ship} className="font-semibold" /> invited
              you to <GangName flag={flag} />
            </p>
          </div>
          <p className="rounded bg-gray-100 p-2">{invite.text}</p>
          <button className="mr-auto w-auto rounded bg-blue p-2 text-white">
            Join Group
          </button>
        </div>
      ) : null}
      {claim ? (
        <div className="flex flex-col space-y-3 rounded border p-2">
          <h4 className="font-bold">Joining Progress</h4>
          <div>
            <div className="h-4 w-72 rounded bg-gray-100">
              <div
                className={cn(
                  'h-4 rounded-l bg-blue',
                  progressClass(claim.progress)
                )}
              />
            </div>
          </div>
          <p className="text-gray-600">{progressDescription(claim.progress)}</p>
        </div>
      ) : (
        <JoinGroup flag={flag} />
      )}
    </div>
  );
}

export function GangModal() {
  const dismiss = useDismissNavigate();
  const location = useLocation();
  const state = location.state as ModalLocationState | null;
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogContent>
        <Gang />
      </DialogContent>
    </Dialog>
  );
}
