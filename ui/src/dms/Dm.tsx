import React, { useCallback, useEffect } from 'react';
import cn from 'classnames';
import { Outlet, Route, Routes, useMatch, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import { useChatState, useDmIsPending } from '@/state/chat';
import ChatWindow from '@/chat/ChatWindow';
import DmInvite from '@/dms/DmInvite';
import Avatar from '@/components/Avatar';
import DmOptions from '@/dms/DMOptions';
import { useContact } from '@/state/contact';
import { useIsMobile } from '@/logic/useMedia';
import DMHero from '@/dms/DMHero';
import useMessageSelector from '@/logic/useMessageSelector';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import ShipName from '@/components/ShipName';
import ChatSearch from '@/chat/ChatSearch/ChatSearch';
import { Contact } from '@/types/contact';
import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import ShipConnection from '@/components/ShipConnection';
import { useConnectivityCheck } from '@/state/vitals';
import MessageSelector from './MessageSelector';

function TitleButton({
  ship,
  contact,
  isMobile,
}: {
  ship: string;
  contact: Contact;
  isMobile: boolean;
}) {
  const BackButton = isMobile ? Link : 'div';
  const { data, showConnection } = useConnectivityCheck(ship || '');

  return (
    <BackButton
      to="/"
      className={cn(
        'default-focus ellipsis w-max-sm inline-flex h-10 appearance-none items-center justify-center space-x-2 rounded p-2'
      )}
      aria-label="Open Messages Menu"
    >
      {isMobile ? (
        <div className="flex h-6 w-6 items-center justify-center">
          <CaretLeft16Icon className="h-5 w-5 shrink-0 text-gray-600" />
        </div>
      ) : null}
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-center">
        <Avatar size="xs" ship={ship} />
      </div>
      <ShipConnection ship={ship} showText={false} status={data?.status} />
      <div className="flex w-full flex-col justify-center">
        {contact?.nickname ? (
          <>
            <span
              className={cn(
                'ellipsis text-sm font-bold line-clamp-1 sm:font-semibold'
              )}
            >
              {contact.nickname}
            </span>
            <ShipName
              full
              name={ship}
              className="w-full break-all text-sm text-gray-400 line-clamp-1"
            />
          </>
        ) : (
          <ShipName
            full
            name={ship}
            className="text-sm font-bold text-gray-800 sm:font-semibold"
          />
        )}
      </div>
    </BackButton>
  );
}

export default function Dm() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const ship = useParams<{ ship: string }>().ship!;
  const { sendMessage } = useChatState.getState();
  const contact = useContact(ship);
  const isMobile = useIsMobile();
  const inSearch = useMatch(`/dm/${ship}/search/*`);
  const isAccepted = !useDmIsPending(ship);
  const canStart = useChatState(
    useCallback((s) => ship && Object.keys(s.briefs).includes(ship), [ship])
  );

  const {
    isSelectingMessage,
    sendDm: sendDmFromMessageSelector,
    existingDm,
  } = useMessageSelector();

  const isSelecting = isSelectingMessage && existingDm === ship;

  useEffect(() => {
    if (ship && canStart) {
      useChatState.getState().initializeDm(ship);
    }
  }, [ship, canStart]);

  return (
    <>
      <Layout
        className="h-full grow"
        header={
          isSelecting ? (
            <MessageSelector />
          ) : (
            <Routes>
              <Route
                path="search/:query?"
                element={
                  <ChatSearch
                    whom={ship}
                    root={`/dm/${ship}`}
                    placeholder="Search Messages"
                  >
                    <TitleButton
                      ship={ship}
                      contact={contact}
                      isMobile={isMobile}
                    />
                  </ChatSearch>
                }
              />
              <Route
                path="*"
                element={
                  <div className="flex items-center justify-between border-b-2 border-gray-50 bg-white py-2 pl-2 pr-4">
                    <TitleButton
                      ship={ship}
                      contact={contact}
                      isMobile={isMobile}
                    />
                    <div className="flex shrink-0 flex-row items-center space-x-3">
                      {isMobile && <ReconnectingSpinner />}
                      <Link
                        to="search/"
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-50"
                        aria-label="Search Chat"
                      >
                        <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
                      </Link>
                      {canStart ? (
                        <DmOptions
                          whom={ship}
                          pending={!isAccepted}
                          alwaysShowEllipsis
                          className="text-gray-600"
                        />
                      ) : null}
                    </div>
                  </div>
                }
              />
            </Routes>
          )
        }
        footer={
          isAccepted ? (
            <div className="border-t-2 border-gray-50 p-4">
              <ChatInput
                key={ship}
                whom={ship}
                sendMessage={
                  isSelecting ? sendDmFromMessageSelector : sendMessage
                }
                showReply
                autoFocus={!isSelecting && !inSearch}
              />
            </div>
          ) : null
        }
      >
        {isAccepted ? (
          <ChatWindow
            whom={ship}
            prefixedElement={
              <div className="pt-4 pb-12">
                <DMHero ship={ship} contact={contact} />
              </div>
            }
          />
        ) : (
          <DmInvite ship={ship} />
        )}
      </Layout>
      <Outlet />
    </>
  );
}
