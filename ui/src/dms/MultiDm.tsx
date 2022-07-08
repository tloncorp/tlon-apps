import React, { useEffect } from 'react';
import cn from 'classnames';
import { Outlet, useParams } from 'react-router';
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
import useNavStore from '@/components/Nav/useNavStore';
import { pluralize } from '@/logic/utils';
import useSendMultiDm from '@/state/chat/useSendMultiDm';
import MultiDmInvite from './MultiDmInvite';
import MultiDmAvatar from './MultiDmAvatar';
import MultiDmHero from './MultiDmHero';
import DmOptions from './DMOptions';

export default function MultiDm() {
  const clubId = useParams<{ ship: string }>().ship!;
  const isMobile = useIsMobile();
  const isAccepted = !useMultiDmIsPending(clubId);
  const club = useMultiDm(clubId);
  const navPrimary = useNavStore((state) => state.navigatePrimary);

  useEffect(() => {
    if (isMobile) {
      navPrimary('hidden');
    }
  }, [navPrimary, isMobile]);

  useEffect(() => {
    if (clubId) {
      useChatState.getState().initializeMultiDm(clubId);
    }
  }, [clubId]);

  const sendMessage = useSendMultiDm();
  const messages = useMultiDmMessages(clubId);

  if (!club) {
    return null;
  }

  const count = club.team.length;
  const pendingCount = club.hive.length;
  const hasPending = pendingCount > 0;
  const groupName = club.meta.title || club.team.concat(club.hive).join(', ');

  return (
    <Layout
      className="h-full grow"
      header={
        <div className="flex h-full items-center justify-between border-b-2 border-gray-50 p-2">
          <button
            className={cn(
              'cursor-pointer select-none p-2 sm:cursor-text sm:select-text',
              isMobile && '-ml-2 flex items-center rounded-lg hover:bg-gray-50'
            )}
            onClick={() => isMobile && navPrimary('dm')}
            aria-label="Open Messages Menu"
          >
            {isMobile ? (
              <CaretLeftIcon className="mr-1 h-5 w-5 text-gray-500" />
            ) : null}
            <div className="flex items-center space-x-3">
              <MultiDmAvatar {...club.meta} size="small" />
              <div className="flex flex-col items-start text-left">
                <div className="w-full truncate font-semibold">{groupName}</div>
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
          </button>
          <DmOptions ship={clubId} pending={!isAccepted} isMulti />
        </div>
      }
      aside={<Outlet />}
      footer={
        isAccepted ? (
          <div className="border-t-2 border-gray-50 p-4">
            <ChatInput whom={clubId} sendMessage={sendMessage} showReply />
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
  );
}
