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
  const ship = useParams<{ ship: string }>().ship!;
  const { sendMessage } = useChatState.getState();
  const contact = useContact(ship);
  const isMobile = useIsMobile();
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

  const BackButton = isMobile ? Link : 'div';

  return (
    <>
      <Layout
        className="h-full grow"
        header={
          <div className="flex h-full items-center justify-between border-b-2 border-gray-50 p-2">
            <BackLink mobile={isMobile}>
              <BackButton
                to="/"
                className={cn(
                  'cursor-pointer select-none p-2 sm:cursor-text sm:select-text',
                  isMobile &&
                    '-ml-2 flex items-center rounded-lg hover:bg-gray-50'
                )}
                aria-label={isMobile ? 'Open Messages Menu' : undefined}
              >
                {isMobile ? (
                  <CaretLeftIcon className="mr-1 h-5 w-5 text-gray-500" />
                ) : null}
                <div className="flex items-center space-x-3">
                  <Avatar size="small" ship={ship} />
                  <div className="flex flex-col items-start">
                    {contact?.nickname ? (
                      <>
                        <span className="font-semibold">
                          {contact.nickname}
                        </span>
                        <span className="text-gray-600">{ship}</span>
                      </>
                    ) : (
                      <span className="font-semibold">{ship}</span>
                    )}
                  </div>
                </div>
              </BackButton>
            </BackLink>
            {canStart ? (
              <DmOptions whom={ship} pending={!isAccepted} alwaysShowEllipsis />
            ) : null}
          </div>
        }
        footer={
          isAccepted ? (
            <div className="border-t-2 border-gray-50 p-4">
              <ChatInput
                whom={ship}
                sendMessage={sendMessage}
                showReply
                autoFocus
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
