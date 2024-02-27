import { Contact } from '@tloncorp/shared/dist/urbit/contact';
import cn from 'classnames';
import React, { useCallback, useMemo, useRef } from 'react';
import {
  Outlet,
  Route,
  Routes,
  useMatch,
  useNavigate,
  useParams,
} from 'react-router';
import { Link } from 'react-router-dom';

import ChatInput from '@/chat/ChatInput/ChatInput';
import Avatar from '@/components/Avatar';
import Layout from '@/components/Layout/Layout';
import MobileHeader from '@/components/MobileHeader';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import ShipConnection from '@/components/ShipConnection';
import ShipName from '@/components/ShipName';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import MagnifyingGlassMobileNavIcon from '@/components/icons/MagnifyingGlassMobileNavIcon';
import DMHero from '@/dms/DMHero';
import DmOptions from '@/dms/DMOptions';
import DmInvite from '@/dms/DmInvite';
import DmWindow from '@/dms/DmWindow';
import { useChatInputFocus } from '@/logic/ChatInputFocusContext';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { useIsScrolling } from '@/logic/scroll';
import { useIsMobile } from '@/logic/useMedia';
import useMessageSelector from '@/logic/useMessageSelector';
import useShowTabBar from '@/logic/useShowTabBar';
import { dmListPath } from '@/logic/utils';
import { useDmIsPending, useDmUnread, useSendMessage } from '@/state/chat';
import { useContact } from '@/state/contact';
import { useNegotiate } from '@/state/negotiation';
import { useConnectivityCheck } from '@/state/vitals';

import DmSearch from './DmSearch';
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
  const { data } = useConnectivityCheck(ship || '');

  return (
    <BackButton
      to={isMobile ? '/messages' : '/'}
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

      <div className="flex w-full flex-col justify-center">
        {contact?.nickname ? (
          <>
            <div className="flex space-x-1 align-middle">
              <span
                className={cn(
                  'ellipsis line-clamp-1 text-sm font-bold sm:font-semibold'
                )}
              >
                {contact.nickname}
              </span>
              <ShipConnection ship={ship} status={data?.status} />
            </div>
            <ShipName
              full
              name={ship}
              className="line-clamp-1 w-full break-all text-sm text-gray-400"
            />
          </>
        ) : (
          <div className="flex space-x-1 align-middle">
            <ShipName
              full
              name={ship}
              className="text-sm font-bold text-gray-800 sm:font-semibold"
            />
            <ShipConnection ship={ship} status={data?.status} />
          </div>
        )}
      </div>
    </BackButton>
  );
}

export default function Dm() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const ship = useParams<{ ship: string }>().ship!;
  const { isChatInputFocused } = useChatInputFocus();
  const dropZoneId = `chat-dm-input-dropzone-${ship}`;
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const { mutate: sendMessage } = useSendMessage();
  const contact = useContact(ship);
  const { data } = useConnectivityCheck(ship || '');
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const inSearch = useMatch(`/dm/${ship}/search/*`);
  const isAccepted = !useDmIsPending(ship);
  const unread = useDmUnread(ship);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);
  const showTabBar = useShowTabBar();
  const canStart = ship && !!unread;
  const root = `/dm/${ship}`;
  const shouldApplyPaddingBottom = showTabBar && !isChatInputFocused;
  const { matchedOrPending, isLoading: negotiationLoading } = useNegotiate(
    ship,
    'chat',
    'chat'
  );
  const confirmedMismatch = !negotiationLoading && !matchedOrPending;

  const {
    isSelectingMessage,
    sendDm: sendDmFromMessageSelector,
    existingDm,
  } = useMessageSelector();

  const isSelecting = isSelectingMessage && existingDm === ship;

  const handleLeave = useCallback(() => {
    navigate(dmListPath);
  }, [navigate]);

  const conversationHeader = useMemo(
    () => (
      <div className="pb-12 pt-4">
        <DMHero ship={ship} contact={contact} />
      </div>
    ),
    [ship, contact]
  );

  return (
    <>
      <Layout
        style={{
          paddingBottom: shouldApplyPaddingBottom ? 50 : 0,
        }}
        className="padding-bottom-transition flex-1"
        header={
          isSelecting ? (
            <>
              {isMobile && (
                <MobileHeader title="New Message" pathBack={dmListPath} />
              )}
              <MessageSelector />
            </>
          ) : (
            <Routes>
              {!isMobile && (
                <Route
                  path="search/:query?"
                  element={
                    <DmSearch
                      whom={ship}
                      root={root}
                      placeholder="Search Messages"
                    >
                      <TitleButton
                        ship={ship}
                        contact={contact}
                        isMobile={isMobile}
                      />
                    </DmSearch>
                  }
                />
              )}
              <Route
                path="*"
                element={
                  isMobile ? (
                    <MobileHeader
                      title={
                        <DmOptions
                          className="w-full"
                          whom={ship}
                          pending={!isAccepted}
                          onLeave={handleLeave}
                        >
                          <button className="flex w-full items-center justify-center">
                            <div className="flex h-6 w-6 flex-none items-center justify-center rounded text-center">
                              <Avatar size="xs" ship={ship} />
                            </div>
                            <h1 className="ml-2 overflow-hidden">
                              <span className="truncate">
                                {contact.nickname ? (
                                  contact.nickname
                                ) : (
                                  <ShipName full name={ship} />
                                )}
                              </span>
                            </h1>
                            <ShipConnection
                              className="ml-1 inline-flex flex-none"
                              type="bullet"
                              ship={ship}
                              status={data?.status}
                            />
                          </button>
                        </DmOptions>
                      }
                      pathBack={isMobile ? '/messages' : '/'}
                      action={
                        <div className="flex h-12 flex-row items-center justify-end space-x-3">
                          <ReconnectingSpinner />
                          <Link to="search/" aria-label="Search Chat">
                            <MagnifyingGlassMobileNavIcon className="h-6 w-6 text-gray-800" />
                          </Link>
                        </div>
                      }
                    />
                  ) : (
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
                            onLeave={handleLeave}
                            whom={ship}
                            pending={!isAccepted}
                            alwaysShowEllipsis
                          />
                        ) : null}
                      </div>
                    </div>
                  )
                }
              />
            </Routes>
          )
        }
        footer={
          <div
            className={cn(
              isDragging || isOver ? '' : 'border-t-2 border-gray-50 p-4'
            )}
          >
            {isAccepted && !confirmedMismatch ? (
              <ChatInput
                key={ship}
                whom={ship}
                sendDm={isSelecting ? sendDmFromMessageSelector : sendMessage}
                showReply
                autoFocus={!isSelecting && !inSearch}
                dropZoneId={dropZoneId}
                isScrolling={isScrolling}
              />
            ) : confirmedMismatch ? (
              <div className="rounded-lg border-2 border-transparent bg-gray-50 px-2 py-1 leading-5 text-gray-600">
                Your version of the app does not match the other party.
              </div>
            ) : null}
          </div>
        }
      >
        {isAccepted ? (
          <DmWindow
            whom={ship}
            root={root}
            prefixedElement={conversationHeader}
          />
        ) : (
          <DmInvite ship={ship} />
        )}
      </Layout>
      <Outlet />
    </>
  );
}
