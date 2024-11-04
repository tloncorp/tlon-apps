import { getKey } from '@tloncorp/shared/urbit/activity';
import cn from 'classnames';
import React, {
  PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Link } from 'react-router-dom';

import ActionMenu, { Action } from '@/components/ActionMenu';
import Dialog from '@/components/Dialog';
import UnreadIndicator from '@/components/Sidebar/UnreadIndicator';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import { useMarkChannelRead } from '@/logic/channel';
import { useIsMobile } from '@/logic/useMedia';
import { useStickyUnread } from '@/logic/useStickyUnread';
import {
  useIsDmOrMultiDm,
  whomIsDm,
  whomIsFlag,
  whomIsMultiDm,
} from '@/logic/utils';
import { useSourceActivity } from '@/state/activity';
import { useLeaveMutation } from '@/state/channel/channel';
import {
  useArchiveDm,
  useDmRsvpMutation,
  useMarkDmReadMutation,
  useMutliDmRsvpMutation,
} from '@/state/chat';
import {
  useAddPinMutation,
  useDeletePinMutation,
  usePinnedChats,
} from '@/state/pins';

import DmInviteDialog from './DmInviteDialog';

type DMOptionsProps = PropsWithChildren<{
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onLeave?: () => void;
  whom: string;
  pending: boolean;
  isHovered?: boolean;
  className?: string;
  isMulti?: boolean;
  alwaysShowEllipsis?: boolean;
  triggerDisabled?: boolean;
}>;

export default function DmOptions({
  open = false,
  onOpenChange,
  onLeave,
  whom,
  pending,
  isHovered = true,
  isMulti = false,
  alwaysShowEllipsis = false,
  triggerDisabled,
  className,
  children,
}: DMOptionsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const pinned = usePinnedChats();
  const { activity } = useSourceActivity(getKey(whom));
  const isDMorMultiDm = useIsDmOrMultiDm(whom);
  const hasNotify = activity.notify;
  const hasActivity = pending || activity.count > 0;
  const key = whomIsFlag(whom) ? `chat/${whom}` : whom;
  const { mutate: leaveChat } = useLeaveMutation();
  const { mutateAsync: addPin } = useAddPinMutation();
  const { mutateAsync: delPin } = useDeletePinMutation();
  const { markRead: markReadChannel } = useMarkChannelRead(
    key,
    undefined,
    true
  );
  const { markDmRead } = useMarkDmReadMutation(whom, undefined, true);
  const { mutate: multiDmRsvp } = useMutliDmRsvpMutation();
  const { mutate: dmRsvp } = useDmRsvpMutation();

  const [isOpen, setIsOpen] = useState(open);
  const handleOpenChange = (innerOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(innerOpen);
    } else {
      setIsOpen(innerOpen);
    }
  };

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  const [inviteIsOpen, setInviteIsOpen] = useState(false);

  const markRead = useCallback(async () => {
    if (isDMorMultiDm) {
      markDmRead();
    } else {
      markReadChannel();
    }
  }, [whom, markReadChannel, markDmRead, isDMorMultiDm]);

  const [dialog, setDialog] = useState(false);

  const leaveMessage = async () => {
    onLeave?.();
    if (whomIsMultiDm(whom)) {
      multiDmRsvp({ id: whom, accept: false });
    } else if (whomIsDm(whom)) {
      dmRsvp({ ship: whom, accept: false });
    } else {
      leaveChat({ nest: whom });
    }
  };
  const closeDialog = () => {
    setDialog(false);
  };

  const handlePin = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.stopPropagation();
      const isPinned = pinned.includes(key);
      if (isPinned) {
        await delPin({ pin: key });
      } else {
        await addPin({ pin: key });
      }
    },
    [whom, key, pinned, addPin, delPin]
  );

  const handleInvite = () => {
    setInviteIsOpen(true);
  };

  const handleAccept = () => {
    dmRsvp({ ship: whom, accept: true });
  };
  const handleDecline = async () => {
    navigate(-1);
    dmRsvp({ ship: whom, accept: false });
  };

  const handleMultiAccept = async () => {
    multiDmRsvp({ id: whom, accept: true });
  };

  const handleMultiDecline = async () => {
    multiDmRsvp({ id: whom, accept: false });
  };

  if (!isHovered && !alwaysShowEllipsis && !isOpen) {
    return hasActivity ? (
      <UnreadIndicator
        count={activity.count}
        notify={hasNotify}
        className="group-focus-within:opacity-0 group-hover:opacity-0"
      />
    ) : null;
  }

  const actions: Action[] = [];

  if (pending) {
    actions.push(
      {
        key: 'accept',
        onClick: isMulti ? handleMultiAccept : handleAccept,
        content: 'Accept',
      },
      {
        key: 'decline',
        onClick: isMulti ? handleMultiDecline : handleDecline,
        content: 'Decline',
      }
    );
  } else {
    if (hasActivity) {
      actions.push({
        key: 'mark',
        type: 'prominent',
        onClick: markRead,
        content: 'Mark Read',
      });
    }

    if (isMulti) {
      actions.push({
        key: 'info',
        content: (
          <Link
            to={`/dm/${whom}/edit-info`}
            state={{ backgroundLocation: location }}
          >
            Chat Info
          </Link>
        ),
      });
    }

    actions.push({
      key: 'pin',
      onClick: handlePin,
      content: pinned.includes(key) ? 'Unpin' : 'Pin',
    });

    if (isMulti) {
      actions.push({
        key: 'invite',
        onClick: handleInvite,
        content: 'Invite',
      });
    }

    actions.push({
      key: 'leave',
      type: 'destructive',
      onClick: () => setDialog(true),
      content: 'Leave Message',
    });
  }

  return (
    <>
      <ActionMenu
        open={isOpen}
        onOpenChange={handleOpenChange}
        actions={actions}
        disabled={triggerDisabled}
        asChild={!triggerDisabled}
        className={className}
      >
        {!alwaysShowEllipsis && children ? (
          children
        ) : (
          <div className={cn('relative h-6 w-6 text-gray-600', className)}>
            {!alwaysShowEllipsis && (isMobile || !isOpen) && hasActivity ? (
              <UnreadIndicator
                count={activity.count}
                notify={hasNotify}
                className="group-focus-within:opacity-0 group-hover:opacity-0"
              />
            ) : null}
            {!isMobile && (
              <button
                className={cn(
                  'default-focus absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg p-0.5 transition-opacity focus-within:opacity-100 hover:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100',
                  hasActivity && hasNotify && 'text-blue',
                  isOpen || alwaysShowEllipsis ? 'opacity:100' : 'opacity-0'
                )}
                aria-label="Open Message Options"
              >
                <EllipsisIcon className="h-6 w-6 text-inherit" />
              </button>
            )}
          </div>
        )}
      </ActionMenu>
      <Dialog open={dialog} onOpenChange={setDialog} containerClass="max-w-md">
        <div className="flex flex-col">
          <h2 className="mb-4 text-lg font-bold">Leave Chat</h2>
          <p className="mb-7 leading-5">
            Are you sure you want to leave this chat? Leaving will move this
            chat into your <strong>Archive</strong>. If you rejoin this channel,
            you’ll download everything you’ve missed since leaving it.
          </p>
          <div className="flex items-center justify-end space-x-2">
            <button onClick={closeDialog} className="button" type="button">
              Cancel
            </button>

            <button
              onClick={leaveMessage}
              className="button bg-red text-white"
              type="button"
            >
              Leave Chat
            </button>
          </div>
        </div>
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
