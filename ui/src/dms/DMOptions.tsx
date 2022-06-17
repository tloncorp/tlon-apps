import cn from 'classnames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import Dialog, { DialogContent } from '../components/Dialog';
import EllipsisIcon from '../components/icons/EllipsisIcon';
import LeaveIcon from '../components/icons/LeaveIcon';
import { useBriefs, useChatState, usePinnedChats } from '../state/chat';
import PinIcon from '../components/icons/PinIcon';
import BulletIcon from '../components/icons/BulletIcon';

interface DMOptionsProps {
  ship: string;
  pending: boolean;
  className?: string;
}

export default function DmOptions({
  ship,
  pending,
  className,
}: DMOptionsProps) {
  const navigate = useNavigate();
  const pinned = usePinnedChats();
  const briefs = useBriefs();
  const hasActivity = (briefs[ship]?.count ?? 0) > 0 || pending;
  const [isOpen, setIsOpen] = useState(false);

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

  const handlePin = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      e.stopPropagation();
      const isPinned = pinned.includes(ship);
      if (isPinned) {
        useChatState.getState().unpinDm(ship);
      } else {
        useChatState.getState().pinDm(ship);
      }
    },
    [ship, pinned]
  );

  return (
    <>
      <DropdownMenu.Root onOpenChange={(open) => setIsOpen(open)} open={isOpen}>
        <DropdownMenu.Trigger asChild>
          <div className="relative h-6 w-6">
            {!isOpen && hasActivity ? (
              <BulletIcon
                className="absolute h-6 w-6 text-blue transition-opacity group-focus-within:opacity-0 group-hover:opacity-0"
                aria-label="Has Activity"
              />
            ) : null}
            <button
              className={cn(
                'default-focus absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg p-0.5 transition-opacity focus-within:opacity-100 hover:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100',
                hasActivity && 'text-blue',
                isOpen ? 'opacity:100' : 'opacity-0'
              )}
              aria-label="Open Message Options"
            >
              <EllipsisIcon className="h-6 w-6" />
            </button>
          </div>
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
