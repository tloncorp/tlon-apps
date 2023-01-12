import cn from 'classnames';
import React, { PropsWithChildren, useCallback, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Link, useLocation } from 'react-router-dom';
import InviteIcon16 from '@/components/icons/InviteIcon16';
import LinkIcon16 from '@/components/icons/LinkIcon16';
import PinIcon16 from '@/components/icons/PinIcon16';
import Person16Icon from '@/components/icons/Person16Icon';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import BulletIcon from '@/components/icons/BulletIcon';
import { useChatState, usePinnedGroups } from '@/state/chat';
import LeaveIcon from '@/components/icons/LeaveIcon';
import useIsGroupUnread from '@/logic/useIsGroupUnread';
import UnreadIndicator from '@/components/Sidebar/UnreadIndicator';
import { citeToPath, useCopy } from '@/logic/utils';

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
    const location = useLocation();
    const hasActivity = isGroupUnread(flag);

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
          <DropdownMenu.Content className="dropdown min-w-52 text-gray-800">
            <DropdownMenu.Item
              asChild
              className="dropdown-item text-blue hover:bg-blue-soft hover:dark:bg-blue-900"
            >
              <Link
                to={`/groups/${flag}/invite`}
                state={{ backgroundLocation: location }}
                className="flex items-center space-x-2"
              >
                <InviteIcon16 className="h-6 w-6 opacity-60" />
                <span className="pr-2">Invite People</span>
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={
                'dropdown-item flex items-center space-x-2 text-blue hover:bg-blue-soft hover:dark:bg-blue-900'
              }
              onSelect={onCopySelect}
            >
              <LinkIcon16 className="h-6 w-6 opacity-60" />
              <span className="pr-2">{copyItemText}</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="dropdown-item flex items-center space-x-2"
              onClick={onPinClick}
            >
              <PinIcon16 className="h-6 w-6 text-gray-600" />
              <span className="pr-2">{isPinned ? 'Unpin' : 'Pin'}</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild className="dropdown-item">
              <Link
                to={`/groups/${flag}/info`}
                // state={{ backgroundLocation: location }}
                className="flex items-center space-x-2"
              >
                <Person16Icon className="m-1 h-4 w-4 text-gray-600" />
                <span className="pr-2">Members &amp; Group Info</span>
              </Link>
            </DropdownMenu.Item>
            {flag.includes(ship) ? null : (
              <DropdownMenu.Item asChild className="dropdown-item">
                <Link
                  to={`/groups/${flag}/leave`}
                  state={{ backgroundLocation: location }}
                  className="flex items-center space-x-2 text-red hover:bg-red-soft hover:dark:bg-red-900"
                >
                  <LeaveIcon className="h-6 w-6" />
                  <span className="pr-2">Leave Group</span>
                </Link>
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    );
  }
);

export default GroupActions;
