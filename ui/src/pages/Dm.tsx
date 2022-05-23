import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { DropdownMenuItem } from '@radix-ui/react-dropdown-menu';
import ChatInput from '../chat/ChatInput/ChatInput';
import ChatMessages from '../chat/ChatMessages';
import Layout from '../components/layout/Layout';
import {
  useChat,
  useChatState,
  useDmIsPending,
  useDmMessages,
} from '../state/chat';
import Dialog, { DialogContent, DialogTrigger } from '../components/Dialog';

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
      useChatState.getState().markRead(ship);
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
        <div className="flex justify-between border-b p-2">
          <h3 className="font-bold">{ship}</h3>
          {canStart ? <DmOptions ship={ship} /> : null}
        </div>
      }
      aside={<Outlet />}
      footer={
        isAccepted ? (
          <div className="p-2">
            <ChatInput whom={ship} />
          </div>
        ) : null
      }
    >
      {isAccepted ? (
        <div className="flex h-full w-full flex-col overflow-auto px-4">
          <div className="mt-auto flex flex-col justify-end">
            <ChatMessages messages={messages} whom={ship} />
          </div>
        </div>
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
