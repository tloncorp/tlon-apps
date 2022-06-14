import cn from 'classnames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import Dialog, { DialogContent } from '../components/Dialog';
import EllipsisIcon from '../components/icons/EllipsisIcon';
import LeaveIcon from '../components/icons/LeaveIcon';
import { useChatState, usePinnedChats } from '../state/chat';
import PinIcon from '../components/icons/PinIcon';

interface DMOptionsProps {
  ship: string;
  className?: string;
}

export default function DmOptions({ ship, className }: DMOptionsProps) {
  const navigate = useNavigate();
  const pinned = usePinnedChats();

  const onArchive = () => {
    navigate(-1);
    useChatState.getState().archiveDm(ship);
  };

  const markRead = useCallback(() => {
    useChatState.getState().markRead(ship);
  }, [ship]);

  const [dialog, setDialog] = useState(false);
  const onTryArchive = (e: Event) => {
    setDialog(true);
  };
  const leaveMessage = () => {
    navigate('/dm');
    useChatState.getState().dmRsvp(ship, false);
  };
  const closeDialog = () => {
    setDialog(false);
  };

  const handlePin = () => {
    const isPinned = pinned.includes(ship);
    if (isPinned) {
      useChatState.getState().unpinDm(ship);
    } else {
      useChatState.getState().pinDm(ship);
    }
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={cn(
            'default-focus rounded-lg p-0.5 text-gray-600',
            className
          )}
          aria-label="Open Message Options"
        >
          <EllipsisIcon className="h-5 w-5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="dropdown">
          <DropdownMenu.Item
            className="dropdown-item flex items-center space-x-3"
            onClick={handlePin}
          >
            <PinIcon className="h-4 w-4" />
            <span>{pinned.includes(ship) ? 'Unpin' : 'Pin'}</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={leaveMessage}
            className="dropdown-item flex items-center space-x-2 text-red"
          >
            <LeaveIcon className="h-6 w-6 opacity-60" />
            Leave Message
          </DropdownMenu.Item>
          <DropdownMenu.Item className="dropdown-item" onClick={markRead}>
            Mark Read
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent containerClass="max-w-md" showClose>
          <div className="flex flex-col">
            <h2 className="mb-4 text-lg font-bold">Leave Chat</h2>
            <p className="mb-7 leading-5">
              Are you sure you want to leave this chat? Leaving will move this
              chat into your <strong>Archive</strong>. If you rejoin this
              channel, you’ll download everything you’ve missed since leaving
              it.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button onClick={closeDialog} className="button" type="button">
                Cancel
              </button>

              <button
                onClick={onArchive}
                className="button bg-red text-white"
                type="button"
              >
                Leave Chat
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
