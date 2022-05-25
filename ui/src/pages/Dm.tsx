import React, { useEffect } from 'react';
import { Outlet, useParams } from 'react-router';
import ChatInput from '../chat/ChatInput/ChatInput';
import Layout from '../components/layout/Layout';
import { useChatState, useDmIsPending, useDmMessages } from '../state/chat';
import ChatWindow from '../chat/ChatWindow';
import DmInvite from './DmInvite';

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

  return (
    <Layout
      className="h-full grow"
      header={
        <h1 className="flex h-full items-center border-b-2 border-gray-50 p-4 text-lg font-bold">
          {ship}
        </h1>
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
        <DmInvite ship={ship} />
      )}
    </Layout>
  );
}
