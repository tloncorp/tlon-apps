import React, { useEffect } from 'react';
import { useParams } from 'react-router';
import ChatInput from '../components/ChatInput/ChatInput';
import ChatMessages from '../components/ChatMessages';
import Layout from '../components/layout/Layout';
import { useChatState, useDmMessages } from '../state/chat';

export default function Dm() {
  const ship = useParams().ship!;
  useEffect(() => {
    useChatState.getState().initializeDm(ship);
  }, [ship]);
  const messages = useDmMessages(ship);

  return (
    <Layout
      className="h-full grow"
      header={<div className="border-b p-2 font-bold">{ship}</div>}
      main={
        <div className="flex h-full w-full flex-col overflow-auto px-4">
          <div className="mt-auto flex flex-col justify-end">
            <ChatMessages messages={messages} whom={ship} />
          </div>
        </div>
      }
      footer={
        <div className="p-2">
          <ChatInput whom={ship} />
        </div>
      }
    />
  );
}
