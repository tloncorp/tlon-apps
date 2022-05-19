import { format, formatDistanceToNow, formatRelative, isToday } from 'date-fns';
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
import { pluralize } from '../logic/utils';

export default function Dm() {
  const ship = useParams<{ ship: string }>().ship!;
  const isAccepted = !useDmIsPending(ship);
  const canStart = useChatState((s) => Object.keys(s.briefs).includes(ship));

  const brief = useChatState((s) => s.briefs[ship]);
  const date = brief ? new Date(brief.last) : new Date();
  const since = isToday(date)
    ? `${format(date, 'HH:mm')} today`
    : format(date, 'LLLL d');

  const unreadMessage =
    brief &&
    `${brief.count} new ${pluralize('message', brief.count)} since ${since}`;

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
        <div className="relative h-full">
          {brief && brief?.count > 0 && (
            <div className="absolute top-2 left-1/2 z-20 flex -translate-x-1/2 items-center space-x-2">
              <button className="button bg-blue-soft text-blue">
                <span className="font-normal">{unreadMessage}</span>
                &nbsp;&bull;&nbsp;View Unread
              </button>
              <button className="button bg-blue-soft text-blue">
                Mark as Read
              </button>
            </div>
          )}
          <div className="flex h-full w-full flex-col overflow-auto px-4 pb-4">
            <div className="mt-auto flex flex-col justify-end">
              <ChatMessages messages={messages} whom={ship} />
            </div>
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
