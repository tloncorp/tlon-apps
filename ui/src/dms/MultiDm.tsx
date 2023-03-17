import React, { useEffect } from 'react';
import cn from 'classnames';
import { Outlet, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import {
  useChatState,
  useMultiDm,
  useMultiDmIsPending,
  useMultiDmMessages,
} from '@/state/chat';
import ChatWindow from '@/chat/ChatWindow';
import { useIsMobile } from '@/logic/useMedia';
import { pluralize } from '@/logic/utils';
import useMessageSelector from '@/logic/useMessageSelector';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import MultiDmInvite from './MultiDmInvite';
import MultiDmAvatar from './MultiDmAvatar';
import MultiDmHero from './MultiDmHero';
import DmOptions from './DMOptions';
import MessageSelector from './MessageSelector';

export default function MultiDm() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const clubId = useParams<{ ship: string }>().ship!;
  const isMobile = useIsMobile();
  const isAccepted = !useMultiDmIsPending(clubId);
  const club = useMultiDm(clubId);

  const { isSelectingMessage, sendDm: sendDmFromMessageSelector } =
    useMessageSelector();

  useEffect(() => {
    if (clubId && club) {
      useChatState.getState().initializeMultiDm(clubId);
    }
  }, [clubId, club]);

  const { sendMessage } = useChatState.getState();
  const messages = useMultiDmMessages(clubId);

  if (!club) {
    return null;
  }

  const count = club.team.length;
  const pendingCount = club.hive.length;
  const hasPending = pendingCount > 0;
  const groupName = club.meta.title || club.team.concat(club.hive).join(', ');
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
                <div className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 text-center">
                  <MultiDmAvatar {...club.meta} size="xs" />
                </div>
                <span className="ellipsis text-gray-400 line-clamp-1">
                  <span className="text-gray-800">{groupName}</span>
                  <span className="ml-2 text-gray-400">
                    <span>{`${count} ${pluralize('Member', count)}${
                      hasPending ? ',' : ''
                    }`}</span>
                    {hasPending ? (
                      <span className="text-blue"> {pendingCount} Pending</span>
                    ) : null}
                  </span>
                </span>
              </BackButton>
              <div className="flex shrink-0 flex-row items-center space-x-3 self-end">
                {isMobile && <ReconnectingSpinner />}
                <DmOptions
                  whom={clubId}
                  pending={!isAccepted}
                  isMulti
                  alwaysShowEllipsis
                  className="text-gray-400"
                />
              </div>
            </div>
          )
        }
        footer={
          isAccepted ? (
            <div className="border-t-2 border-gray-50 p-4">
              <ChatInput
                key={clubId}
                whom={clubId}
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
            whom={clubId}
            messages={messages}
            prefixedElement={
              <div className="pt-4 pb-12">
                <MultiDmHero club={club} />
              </div>
            }
          />
        ) : (
          <MultiDmInvite id={clubId} />
        )}
      </Layout>
      <Outlet />
    </>
  );
}
