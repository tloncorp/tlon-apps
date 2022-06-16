import React, { PropsWithChildren, useCallback } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Link, useLocation } from 'react-router-dom';
import InviteIcon16 from '../icons/InviteIcon16';
import LinkIcon16 from '../icons/LinkIcon16';
import PinIcon16 from '../icons/PinIcon16';
import useCopyToClipboard from '../../logic/useCopyToClipboard';
import Person16Icon from '../icons/Person16Icon';

export function useGroupActions(flag: string) {
  const [_copied, doCopy] = useCopyToClipboard();

  const onCopyClick = useCallback(
    // eslint-disable-next-line prefer-arrow-callback
    function <T>(e: React.MouseEvent<T>) {
      e.stopPropagation();
      doCopy(flag);
    },
    [doCopy, flag]
  );

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
  const { onCopyClick, onPinClick } = useGroupActions(flag);

  return (
    <div className={className}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
        <DropdownMenu.Content className="dropdown min-w-52 text-gray-800">
          <DropdownMenu.Item
            asChild
            className={'dropdown-item rounded-none text-blue'}
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
          >
            <LinkIcon16 className="h-6 w-6 opacity-60" />
            <span className="pr-2">Copy Group Link</span>
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
