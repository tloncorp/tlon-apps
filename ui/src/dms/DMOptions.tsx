import cn from 'classnames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import React, { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Link } from 'react-router-dom';
import Dialog, { DialogContent } from '@/components/Dialog';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import LeaveIcon from '@/components/icons/LeaveIcon';
import { useChatState, usePinned } from '@/state/chat';
import PinIcon from '@/components/icons/PinIcon';
import BulletIcon from '@/components/icons/BulletIcon';
import InviteIcon16 from '@/components/icons/InviteIcon16';
import { whomIsMultiDm } from '@/logic/utils';
import PeopleIcon from '@/components/icons/PeopleIcon';
import useIsChannelUnread from '@/logic/useIsChannelUnread';
import DmInviteDialog from './DmInviteDialog';

interface DMOptionsProps {
  whom: string;
  pending: boolean;
  className?: string;
  isMulti?: boolean;
  alwaysShowEllipsis?: boolean;
}

export default function DmOptions({
  whom,
  pending,
  isMulti = false,
  alwaysShowEllipsis = false,
  className,
}: DMOptionsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pinned = usePinned();
  const isUnread = useIsChannelUnread(`chat/${whom}`);
  const hasActivity = isUnread || pending;
  const [isOpen, setIsOpen] = useState(false);
  const [inviteIsOpen, setInviteIsOpen] = useState(false);
  const onArchive = () => {
    navigate(-1);
    useChatState.getState().archiveDm(whom);
  };

  const markRead = useCallback(() => {
    useChatState.getState().markRead(whom);
  }, [whom]);

  const [dialog, setDialog] = useState(false);

  const leaveMessage = () => {
    navigate('/dm');
    if (whomIsMultiDm(whom)) {
      useChatState.getState().multiDmRsvp(whom, false);
    } else {
      useChatState.getState().dmRsvp(whom, false);
    }
  };
  const closeDialog = () => {
    setDialog(false);
  };

  const handlePin = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      e.stopPropagation();
      const isPinned = pinned.includes(whom);
      useChatState.getState().togglePin(whom, !isPinned);
    },
    [whom, pinned]
  );

  const handleInvite = () => {
    setInviteIsOpen(true);
  };

  const handleAccept = () => {
    useChatState.getState().dmRsvp(whom, true);
  };
  const handleDecline = () => {
    navigate(-1);
    useChatState.getState().dmRsvp(whom, false);
  };

  const handleMultiAccept = () => {
    useChatState.getState().multiDmRsvp(whom, true);
  };

  const handleMultiDecline = () => {
    useChatState.getState().multiDmRsvp(whom, false);
  };

  return (
    <>
      <DropdownMenu.Root onOpenChange={(open) => setIsOpen(open)} open={isOpen}>
        <DropdownMenu.Trigger asChild className="appearance-none">
          <div className="relative h-6 w-6">
            {!alwaysShowEllipsis && !isOpen && hasActivity ? (
              <BulletIcon
                className="absolute h-6 w-6 text-blue transition-opacity group-focus-within:opacity-0 group-hover:opacity-0"
                aria-label="Has Activity"
              />
            ) : null}
            <button
              className={cn(
                'default-focus absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg p-0.5 transition-opacity focus-within:opacity-100 hover:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100',
                hasActivity && 'text-blue',
                isOpen || alwaysShowEllipsis ? 'opacity:100' : 'opacity-0'
              )}
              aria-label="Open Message Options"
            >
              <EllipsisIcon className="h-6 w-6" />
            </button>
          </div>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="dropdown">
          {pending ? (
            <>
              <DropdownMenu.Item
                className="dropdown-item flex items-center space-x-2"
                onClick={isMulti ? handleMultiAccept : handleAccept}
              >
                <PeopleIcon className="h-6 w-6" />
                <span>Accept</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="dropdown-item flex items-center space-x-2"
                onClick={isMulti ? handleMultiDecline : handleDecline}
              >
                <PeopleIcon className="h-6 w-6" />
                <span>Decline</span>
              </DropdownMenu.Item>
            </>
          ) : (
            <>
              {hasActivity ? (
                <DropdownMenu.Item
                  className="dropdown-item flex items-center space-x-2 text-blue hover:bg-blue-soft hover:dark:bg-blue-900"
                  onClick={markRead}
                >
                  <BulletIcon className="h-6 w-6" />
                  <span>Mark Read</span>
                </DropdownMenu.Item>
              ) : null}
              {isMulti ? (
                <DropdownMenu.Item
                  className="dropdown-item flex items-center space-x-2"
                  asChild
                >
                  <Link
                    to={`/dm/${whom}/edit-info`}
                    state={{ backgroundLocation: location }}
                  >
                    <PeopleIcon className="h-6 w-6" />
                    <span>Chat Info</span>
                  </Link>
                </DropdownMenu.Item>
              ) : null}
              <DropdownMenu.Item
                className="dropdown-item flex items-center space-x-3"
                onClick={handlePin}
              >
                <PinIcon className="h-4 w-4" />
                <span>{pinned.includes(whom) ? 'Unpin' : 'Pin'}</span>
              </DropdownMenu.Item>
              {isMulti ? (
                <DropdownMenu.Item
                  className="dropdown-item flex items-center space-x-2"
                  onClick={handleInvite}
                >
                  <InviteIcon16 className="h-6 w-6" />
                  <span>Invite</span>
                </DropdownMenu.Item>
              ) : null}
              <DropdownMenu.Item
                onSelect={leaveMessage}
                className="dropdown-item flex items-center space-x-2 text-red hover:bg-red-soft hover:dark:bg-red-900"
              >
                <LeaveIcon className="h-6 w-6 opacity-60" />
                <span>Leave Message</span>
              </DropdownMenu.Item>
            </>
          )}
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
      {isMulti ? (
        <DmInviteDialog
          inviteIsOpen={inviteIsOpen}
          setInviteIsOpen={setInviteIsOpen}
          whom={whom}
        />
      ) : null}
    </>
  );
}
