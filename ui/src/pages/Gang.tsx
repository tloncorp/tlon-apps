import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import cn from 'classnames';
import { Location, useLocation, useNavigate } from 'react-router';
import ShipImage from '../components/ChatMessage/ShipImage';
import { useGang, useRouteGroup } from '../state/groups';
import { JoinProgress } from '../types/groups';
import GangName from '../components/GangName/GangName';
import GangPreview from '../components/GangPreview/GangPreview';

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
  return (
    <div className="flex flex-col space-y-4 p-4">
      {preview ? <GangPreview preview={preview} /> : null}
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
      ) : null}

      {invite ? (
        <div className="flex flex-col space-y-3 rounded border p-2">
          <div className="flex items-center space-x-2">
            <ShipImage ship={invite.ship} />
            <p>
              <span className="text-mono font-bold">{invite.ship}</span> invited
              you to <GangName flag={flag} />
            </p>
          </div>
          <p className="rounded bg-gray-100 p-2">{invite.text}</p>
          <button className="mr-auto w-auto rounded bg-blue p-2 text-white">
            Join Group
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function GangModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { backgroundLocation: Location };
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen && state?.backgroundLocation) {
      navigate(state?.backgroundLocation);
    }
  };

  return (
    <Dialog.Root defaultOpen onOpenChange={onOpenChange}>
      <Dialog.Trigger />
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 flex items-center justify-center bg-black shadow">
          <Dialog.Content className="w-144 rounded bg-white">
            <Gang />
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
