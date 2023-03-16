import React, { useCallback, useEffect } from 'react';
import cn from 'classnames';
import { Outlet, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import { useChatState, useDmIsPending, useDmMessages } from '@/state/chat';
import ChatWindow from '@/chat/ChatWindow';
import DmInvite from '@/dms/DmInvite';
import Avatar from '@/components/Avatar';
import DmOptions from '@/dms/DMOptions';
import { useContact } from '@/state/contact';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import { useIsMobile } from '@/logic/useMedia';
import DMHero from '@/dms/DMHero';
import useMessageSelector from '@/logic/useMessageSelector';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import MessageSelector from './MessageSelector';

function BackLink({
  children,
  mobile,
}: {
  children: React.ReactNode;
  mobile: boolean;
}) {
  return mobile ? (
    <Link className="no-underline" to="/">
      {children}
    </Link>
  ) : (
    <div>{children}</div>
  );
}

export default function Dm() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const ship = useParams<{ ship: string }>().ship!;
  const { sendMessage } = useChatState.getState();
  const contact = useContact(ship);
  const isMobile = useIsMobile();
  const isAccepted = !useDmIsPending(ship);
  const canStart = useChatState(
    useCallback((s) => ship && Object.keys(s.briefs).includes(ship), [ship])
  );

  const { isSelectingMessage, sendDm: sendDmFromMessageSelector } =
    useMessageSelector();

  useEffect(() => {
    if (ship && canStart) {
      useChatState.getState().initializeDm(ship);
    }
  }, [ship, canStart]);
  const messages = useDmMessages(ship);

  const BackButton = isMobile ? Link : 'div';

  return (
    <>
      <Layout
        className="h-full grow"
        header={
          isSelectingMessage ? (
            <MessageSelector />
          ) : (
            <div
              className={cn(
                'flex items-center justify-between bg-white',
                isMobile
                  ? 'px-6 pt-10 pb-4'
                  : 'border-b-2 border-gray-50 px-4 py-4'
              )}
            >
              <BackLink mobile={isMobile}>
                <BackButton
                  to="/"
                  className={cn(
                    'default-focus ellipsis inline-flex appearance-none items-center pr-2 text-lg font-bold text-gray-800 sm:text-base sm:font-semibold'
                  )}
                  aria-label={isMobile ? 'Open Messages Menu' : undefined}
                >
                  {isMobile ? (
                    <CaretLeft16Icon className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
                  ) : null}
                  <div className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 p-1 text-center">
                    <Avatar size="xs" ship={ship} />
                  </div>
                  <span className="ellipsis text-gray-200 line-clamp-1">
                    {contact?.nickname ? (
                      <>
                        <span className="text-gray-800">
                          {contact.nickname}
                        </span>
                        <span className="ml-2 text-gray-400">{ship}</span>
                      </>
                    ) : (
                      <span className="text-gray-800">{ship}</span>
                    )}
                  </span>
                </BackButton>
              </BackLink>
              <div className="flex shrink-0 flex-row items-center space-x-4 self-end">
                {isMobile && <ReconnectingSpinner />}
                {canStart ? (
                  <DmOptions
                    whom={ship}
                    pending={!isAccepted}
                    alwaysShowEllipsis
                  />
                ) : null}
              </div>
            </div>
          )
        }
        footer={
          isAccepted ? (
            <div className="border-t-2 border-gray-50 p-4">
              <ChatInput
                key={ship}
                whom={ship}
                sendMessage={
                  isSelectingMessage ? sendDmFromMessageSelector : sendMessage
                }
                showReply
                autoFocus={!isSelectingMessage}
              />
            </div>
          ) : null
        }
      >
        {isAccepted ? (
          <ChatWindow
            whom={ship}
            messages={messages}
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
