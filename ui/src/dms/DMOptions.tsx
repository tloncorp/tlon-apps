import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import Dialog, { DialogContent } from '../components/Dialog';
import { useChatState } from '../state/chat';

export default function DmOptions(props: { ship: string }) {
  const { ship } = props;
  const navigate = useNavigate();

  const onArchive = () => {
    navigate(-1);
    useChatState.getState().archiveDm(ship);
  };
  const [dialog, setDialog] = useState(false);
  const onTryArchive = (e: Event) => {
    setDialog(true);
  };
  const closeDialog = () => {
    setDialog(false);
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>X</DropdownMenu.Trigger>
        <DropdownMenu.Content className="space-y-2 rounded border bg-white p-2">
          <DropdownMenu.Item onSelect={onTryArchive} className="p-2">
            Archive
          </DropdownMenu.Item>
          <DropdownMenu.Item className="p-2">Mark Read</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent containerClass="max-w-sm" showClose>
          <div className="flex flex-col space-y-4">
            <h4 className="font-bold">Archive DM?</h4>
            <p>
              Are you sure you want to leave this chat? Leaving will move this
              chat into your Archive. If you rejoin this channel, you’ll
              download everything you’ve missed since leaving it.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button onClick={closeDialog} className="button" type="button">
                Cancel
              </button>

              <button
                onClick={onArchive}
                className="button bg-red-500"
                type="button"
              >
                Archive
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
