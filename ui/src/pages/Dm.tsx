import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import ChatWindow from '../chat/ChatWindow';
import ChatInput from '../chat/ChatInput/ChatInput';
import Layout from '../components/layout/Layout';
import { useChatState, useDmIsPending, useDmMessages } from '../state/chat';
import Dialog, { DialogContent } from '../components/Dialog';

function DmOptions(props: { ship: string }) {
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

export default function Dm() {
  const ship = useParams<{ ship: string }>().ship!;
  const isAccepted = !useDmIsPending(ship);
  const canStart = useChatState((s) => Object.keys(s.briefs).includes(ship));

  useEffect(() => {
    if (canStart) {
      useChatState.getState().initializeDm(ship);
    }
  }, [ship, canStart]);
  const messages = useDmMessages(ship);
  const navigate = useNavigate();
  const onAccept = () => {
    useChatState.getState().dmRsvp(ship, true);
  };
  const onDecline = () => {
    navigate(-1);
    useChatState.getState().dmRsvp(ship, false);
  };

  return (
    <Layout
      className="h-full grow"
      header={
        <div className="flex h-full items-center justify-between border-b-2 border-gray-50 p-4">
          <h3 className="text-lg font-bold">{ship}</h3>
          {canStart ? <DmOptions ship={ship} /> : null}
        </div>
      }
      aside={<Outlet />}
      footer={
        isAccepted ? (
          <div className="border-t-2 border-gray-50 p-4">
            <ChatInput whom={ship} />
          </div>
        ) : null
      }
    >
      {isAccepted ? (
        <ChatWindow whom={ship} messages={messages} />
      ) : (
        <div className="flex flex-col">
          <div className="flex">
            <button onClick={onDecline} type="button">
              Decline
            </button>
            <button onClick={onAccept} type="button">
              Accept
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
