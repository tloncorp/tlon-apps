import cn from 'classnames';
import React, { PropsWithChildren, useCallback, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
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
    // eslint-disable-next-line prefer-arrow-callback
    function <T>(e: React.MouseEvent<T>) {
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
  className?: string;
}>;

const GroupActions = React.memo(
  ({ flag, className, children }: GroupActionsProps) => {
    const { isGroupUnread } = useIsGroupUnread();
    const { preview, claim } = useGang(flag);
    const location = useLocation();
    const hasActivity = isGroupUnread(flag);
    const group = useGroup(flag);
    const privacy = group ? getPrivacyFromGroup(group) : 'public';
    const isAdmin = useAmAdmin(flag);
    const { mutate: cancelJoinMutation, status: cancelJoinStatus } =
      useGroupCancelMutation();

    const { isOpen, setIsOpen, isPinned, copyItemText, onCopy, onPinClick } =
      useGroupActions(flag);

    const onCopySelect = useCallback(
      (event: Event) => {
        event.preventDefault();
        onCopy();
      },
      [onCopy]
    );

    return (
      <div className={className}>
        <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenu.Trigger asChild className="appearance-none">
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
          </DropdownMenu.Trigger>
          <DropdownMenu.Content className="dropdown min-w-52">
            {(privacy === 'public' || isAdmin) && (
              <DropdownMenu.Item asChild className="dropdown-item-blue">
                <Link
                  to={`/groups/${flag}/invite`}
                  state={{ backgroundLocation: location }}
                >
                  Invite People
                </Link>
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item
              className="dropdown-item"
              onSelect={onCopySelect}
            >
              {copyItemText}
            </DropdownMenu.Item>
            <DropdownMenu.Item className="dropdown-item" onClick={onPinClick}>
              {isPinned ? 'Unpin' : 'Pin'}
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild className="dropdown-item">
              {isAdmin ? (
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
              )}
            </DropdownMenu.Item>
            {flag.includes(ship) ? null : (
              <DropdownMenu.Item asChild className="dropdown-item-red">
                <Link
                  to={`/groups/${flag}/leave`}
                  state={{ backgroundLocation: location }}
                >
                  Leave Group
                </Link>
              </DropdownMenu.Item>
            )}
            {claim && (
              <DropdownMenu.Item
                className="dropdown-item-red"
                onSelect={() => cancelJoinMutation({ flag })}
              >
                Cancel Join
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    );
  }
);

export default GroupActions;
