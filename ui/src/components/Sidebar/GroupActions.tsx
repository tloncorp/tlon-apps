import cn from 'classnames';
import React, { PropsWithChildren, useCallback, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Link, useLocation } from 'react-router-dom';
import InviteIcon16 from '../icons/InviteIcon16';
import LinkIcon16 from '../icons/LinkIcon16';
import PinIcon16 from '../icons/PinIcon16';
import useCopyToClipboard from '../../logic/useCopyToClipboard';
import Person16Icon from '../icons/Person16Icon';
import EllipsisIcon from '../icons/EllipsisIcon';
import BulletIcon from '../icons/BulletIcon';
import { useBriefs } from '../../state/chat';

export function useGroupActions(flag: string) {
  const [_copied, doCopy] = useCopyToClipboard();
  const [isOpen, setIsOpen] = useState(false);
  const [copyItemText, setCopyItemText] = useState('Copy Group Link');

  const onCopyClick = useCallback(
    // eslint-disable-next-line prefer-arrow-callback
    function <T>(e: React.MouseEvent<T>) {
      e.stopPropagation();
      doCopy(flag);
    },
    [doCopy, flag]
  );

  const onCopySelect = useCallback((e: Event) => {
    e.preventDefault();
    setCopyItemText('Copied!');
    setTimeout(() => {
      setCopyItemText('Copy Group Link');
      setIsOpen(false);
    }, 1000);
  }, []);

  const onPinClick = useCallback(
    // eslint-disable-next-line prefer-arrow-callback
    function <T>(e: React.MouseEvent<T>) {
      e.stopPropagation();
      // TODO
      // eslint-disable-next-line no-console
      console.log('pin');
    },
    []
  );

  return {
    isOpen,
    setIsOpen,
    copyItemText,
    onCopySelect,
    onCopyClick,
    onPinClick,
  };
}

type GroupActionsProps = PropsWithChildren<{
  flag: string;
  className?: string;
}>;

export default function GroupActions({
  flag,
  className,
  children,
}: GroupActionsProps) {
  const location = useLocation();
  const briefs = useBriefs();
  const hasActivity = (briefs[flag]?.count ?? 0) > 0;

  const {
    isOpen,
    setIsOpen,
    copyItemText,
    onCopySelect,
    onCopyClick,
    onPinClick,
  } = useGroupActions(flag);

  return (
    <div className={className}>
      <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenu.Trigger asChild>
          {children || (
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
            className="dropdown-item rounded-none text-blue"
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
              'dropdown-item flex items-center space-x-2 rounded-none text-blue'
            }
            onClick={onCopyClick}
            onSelect={onCopySelect}
          >
            <LinkIcon16 className="h-6 w-6 opacity-60" />
            <span className="pr-2">{copyItemText}</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="dropdown-item flex items-center space-x-2 rounded-none"
            onClick={onPinClick}
          >
            <PinIcon16 className="h-6 w-6 text-gray-600" />
            <span className="pr-2">Pin</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className="dropdown-item rounded-none">
            <Link
              to={`/groups/${flag}/info`}
              state={{ backgroundLocation: location }}
              className="flex items-center space-x-2"
            >
              <Person16Icon className="m-1 h-4 w-4 text-gray-600" />
              <span className="pr-2">Members &amp; Group Info</span>
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}
