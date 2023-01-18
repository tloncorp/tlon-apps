import React, { useCallback, useEffect } from 'react';
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
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import { useIsMobile } from '@/logic/useMedia';
import { pluralize } from '@/logic/utils';
import MultiDmInvite from './MultiDmInvite';
import MultiDmAvatar from './MultiDmAvatar';
import MultiDmHero from './MultiDmHero';
import DmOptions from './DMOptions';

export default function MultiDm() {
  const clubId = useParams<{ ship: string }>().ship!;
  const isMobile = useIsMobile();
  const isAccepted = !useMultiDmIsPending(clubId);
  const club = useMultiDm(clubId);

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
          <div className="flex h-full w-full items-center justify-between border-b-2 border-gray-50 p-2">
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
                <MultiDmAvatar {...club.meta} size="small" />
                <div className="flex flex-col items-start text-left">
                  <div className="font-semibold line-clamp-1">{groupName}</div>
                  <div className="text-gray-600">
                    <span>{`${count} ${pluralize('Member', count)}${
                      hasPending ? ',' : ''
                    }`}</span>
                    {hasPending ? (
                      <span className="text-blue"> {pendingCount} Pending</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </BackButton>
            <DmOptions
              whom={clubId}
              pending={!isAccepted}
              isMulti
              alwaysShowEllipsis
            />
          </div>
        }
        footer={
          isAccepted ? (
            <div className="border-t-2 border-gray-50 p-4">
              <ChatInput
                whom={clubId}
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
