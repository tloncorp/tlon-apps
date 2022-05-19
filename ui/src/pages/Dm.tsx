import React, { useEffect } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router';
import ChatInput from '../chat/ChatInput/ChatInput';
import ChatMessages from '../chat/ChatMessages';
import Layout from '../components/layout/Layout';
import {
  useChat,
  useChatState,
  useDmIsPending,
  useDmMessages,
} from '../state/chat';

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
      header={<div className="border-b p-2 font-bold">{ship}</div>}
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
