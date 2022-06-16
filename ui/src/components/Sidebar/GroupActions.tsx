import React, { useCallback, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import cn from 'classnames';
import EllipsisIcon from '../icons/EllipsisIcon';
import InviteIcon16 from '../icons/InviteIcon16';
import LinkIcon16 from '../icons/LinkIcon16';
import PinIcon16 from '../icons/PinIcon16';
import useCopyToClipboard from '../../logic/useCopyToClipboard';
import GroupInviteDialog from './GroupInviteDialog';

export function useGroupActions(flag: string) {
  const [_copied, doCopy] = useCopyToClipboard();
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const onCloseInviteDialog = useCallback(
    (e: React.MouseEvent<HTMLButtonElement | HTMLDivElement>) => {
      e.stopPropagation();
      setShowInviteDialog(false);
    },
    []
  );

  const onInviteClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement | HTMLDivElement>) => {
      e.stopPropagation();
      setShowInviteDialog(true);
    },
    []
  );

  const onCopyClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement | HTMLDivElement>) => {
      e.stopPropagation();
      doCopy(flag);
    },
    [doCopy, flag]
  );

  const onPinClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement | HTMLDivElement>) => {
      e.stopPropagation();
      // TODO
      // eslint-disable-next-line no-console
      console.log('pin');
    },
    []
  );

  return {
    showInviteDialog,
    setShowInviteDialog,
    onCloseInviteDialog,
    onInviteClick,
    onCopyClick,
    onPinClick,
  };
}

export default function GroupActions({ flag }: { flag: string }) {
  const {
    showInviteDialog,
    setShowInviteDialog,
    onCloseInviteDialog,
    onInviteClick,
    onCopyClick,
    onPinClick,
  } = useGroupActions(flag);

  return (
    <div>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={'default-focus rounded-lg p-0.5 text-gray-600'}
          aria-label="Open Message Options"
        >
          <EllipsisIcon className="h-5 w-5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="dropdown">
          <DropdownMenu.Item
            className={
              'dropdown-item flex items-center space-x-2 rounded-none text-blue'
            }
            onClick={onInviteClick}
          >
            <InviteIcon16 className="h-6 w-6" />
            <span className="pr-2">Invite People</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={
              'dropdown-item flex items-center space-x-2 rounded-none text-blue'
            }
            onClick={onCopyClick}
          >
            <LinkIcon16 className="h-6 w-6" />
            <span className="pr-2">Copy Group Link</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="dropdown-item flex items-center space-x-2 rounded-none"
            onClick={onPinClick}
          >
            <PinIcon16 className="h-6 w-6 text-gray-600" />
            <span className="pr-2">Pin</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <GroupInviteDialog
        flag={flag}
        open={showInviteDialog}
        onClose={onCloseInviteDialog}
        onOpenChange={setShowInviteDialog}
      />
    </div>
  );
}
