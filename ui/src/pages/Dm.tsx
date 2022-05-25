import React, { useCallback, useEffect } from 'react';
import cn from 'classnames';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import ChatWindow from '../chat/ChatWindow';
import ChatInput from '../chat/ChatInput/ChatInput';
import Layout from '../components/layout/Layout';
import { useChatState, useDmIsPending, useDmMessages } from '../state/chat';
import DmOptions from '../dms/DMOptions';
import LeftIcon from '../components/icons/LeftIcon';
import useMedia from '../logic/useMedia';

export default function Dm() {
  const ship = useParams<{ ship: string }>().ship || '';
  const location = useLocation();
  const isMobile = useMedia('(max-width: 767px)');
  const isAccepted = !useDmIsPending(ship);
  const canStart = useChatState(
    useCallback((s) => ship && Object.keys(s.briefs).includes(ship), [ship])
  );

  useEffect(() => {
    if (ship && canStart) {
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
        <div className="flex h-full items-center justify-between border-b-2 border-gray-50 p-2">
          <Link
            to=".."
            state={{ backgroundLocation: location }}
            className={cn(
              'p-2',
              isMobile && '-ml-2 flex items-center rounded-lg hover:bg-gray-50'
            )}
            aria-label="Open Messages Menu"
          >
            {isMobile ? (
              <LeftIcon className="mr-1 h-5 w-5 text-gray-500" />
            ) : null}
            <h1 className="text-lg font-bold">{ship}</h1>
          </Link>
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
