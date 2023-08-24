import cn from 'classnames';
import React, { PropsWithChildren, useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import { useChatState, usePinnedGroups } from '@/state/chat';
import useIsGroupUnread from '@/logic/useIsGroupUnread';
import UnreadIndicator from '@/components/Sidebar/UnreadIndicator';
import { citeToPath, getPrivacyFromGroup, useCopy } from '@/logic/utils';
import {
  useAmAdmin,
  useGang,
  useGroup,
  useGroupCancelMutation,
} from '@/state/groups';
import ActionMenu, { Action } from '@/components/ActionMenu';
import { Saga } from '@/types/groups';
import { ConnectionStatus } from '@/state/vitals';
import HostConnection from '@/channels/HostConnection';
import { useIsMobile } from '@/logic/useMedia';

const { ship } = window;

export function useGroupActions(flag: string) {
  const { doCopy } = useCopy(citeToPath({ group: flag }));
  const [isOpen, setIsOpen] = useState(false);
  const [copyItemText, setCopyItemText] = useState('Copy Group Link');
  const pinned = usePinnedGroups();
  const isPinned = Object.keys(pinned).includes(flag);

  const onCopy = useCallback(() => {
    doCopy();
    setCopyItemText('Copied!');
    setTimeout(() => {
      setCopyItemText('Copy Group Link');
      setIsOpen(false);
    }, 2000);
  }, [doCopy]);

  const onPinClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      useChatState.getState().togglePin(flag, !isPinned);
    },
    [flag, isPinned]
  );

  return {
    isOpen,
    isPinned,
    setIsOpen,
    copyItemText,
    onCopy,
    onPinClick,
  };
}

type GroupActionsProps = PropsWithChildren<{
  flag: string;
  saga?: Saga | null;
  status?: ConnectionStatus;
  className?: string;
}>;

const GroupActions = React.memo(
  ({ flag, saga, status, className, children }: GroupActionsProps) => {
    const { isGroupUnread } = useIsGroupUnread();
    const { claim } = useGang(flag);
    const location = useLocation();
    const hasActivity = isGroupUnread(flag);
    const group = useGroup(flag);
    const privacy = group ? getPrivacyFromGroup(group) : 'public';
    const isAdmin = useAmAdmin(flag);
    const isMobile = useIsMobile();
    const { mutate: cancelJoinMutation } = useGroupCancelMutation();
    const { isOpen, setIsOpen, isPinned, copyItemText, onCopy, onPinClick } =
      useGroupActions(flag);

    const onCopySelect = useCallback(
      (event: React.MouseEvent) => {
        event.preventDefault();
        onCopy();
      },
      [onCopy]
    );

    const actions: Action[] = [];

    if (saga && isMobile) {
      actions.push({
        key: 'connectivity',
        keepOpenOnClick: true,
        content: (
          <HostConnection
            ship={flag}
            status={status}
            saga={saga}
            type="combo"
            className="-ml-1 text-[17px] font-medium text-gray-800"
          />
        ),
      });
    }

    if (privacy === 'public' || isAdmin) {
      actions.push({
        key: 'invite',
        type: 'prominent',
        content: (
          <Link
            to={`/groups/${flag}/invite`}
            state={{ backgroundLocation: location }}
          >
            Invite People
          </Link>
        ),
      });
    }

    actions.push(
      {
        key: 'copy',
        onClick: onCopySelect,
        content: copyItemText,
        keepOpenOnClick: true,
      },
      {
        key: 'pin',
        onClick: onPinClick,
        content: isPinned ? 'Unpin' : 'Pin',
      },
      {
        key: 'settings',
        onClick: () => setIsOpen(false),
        content: isAdmin ? (
          <Link
            to={`/groups/${flag}/edit`}
            state={{ backgroundLocation: location }}
          >
            Group Settings
          </Link>
        ) : (
          <Link
            to={`/groups/${flag}/info`}
            state={{ backgroundLocation: location }}
          >
            Group Members & Info
          </Link>
        ),
      }
    );

    if (!flag.includes(ship)) {
      actions.push({
        key: 'leave',
        type: 'destructive',
        content: (
          <Link
            to={`/groups/${flag}/leave`}
            state={{ backgroundLocation: location }}
          >
            Leave Group
          </Link>
        ),
      });
    }

    if (claim) {
      actions.push({
        key: 'cancel_join',
        type: 'destructive',
        onClick: () => {
          cancelJoinMutation({ flag });
          setIsOpen(false);
        },
        content: 'Cancel Join',
      });
    }

    return (
      <ActionMenu
        open={isOpen}
        onOpenChange={setIsOpen}
        actions={actions}
        className={className}
      >
        {children || (
          <div className="relative h-6 w-6">
            {!isOpen && hasActivity ? (
              <UnreadIndicator
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
              aria-label="Open Group Options"
            >
              <EllipsisIcon className="h-6 w-6" />
            </button>
          </div>
        )}
      </ActionMenu>
    );
  }
);

export default GroupActions;
