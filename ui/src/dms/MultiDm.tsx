import React, { useCallback, useEffect } from 'react';
import cn from 'classnames';
import { Outlet, useParams } from 'react-router';
import ChatInput from '../chat/ChatInput/ChatInput';
import Layout from '../components/Layout/Layout';
import {
  useChatState,
  useMultiDm,
  useMultiDmIsPending,
  useMultiDmMessages,
} from '../state/chat';
import ChatWindow from '../chat/ChatWindow';
import DmOptions from './DMOptions';
import CaretLeftIcon from '../components/icons/CaretLeftIcon';
import { useIsMobile } from '../logic/useMedia';
import useNavStore from '../components/Nav/useNavStore';
import MultiDmInvite from './MultiDmInvite';
import MultiDmAvatar from './MultiDmAvatar';
import MultiDmHero from './MultiDmHero';
import { pluralize } from '../logic/utils';
import useSendMultiDm from '../state/chat/useSendMultiDm';

export default function MultiDm() {
  const clubId = useParams<{ ship: string }>().ship!;
  const isMobile = useIsMobile();
  const isAccepted = !useMultiDmIsPending(clubId);
  const club = useMultiDm(clubId);
  const canStart = useChatState(
    useCallback(
      (s) => clubId && Object.keys(s.briefs).includes(clubId),
      [clubId]
    )
  );
  const navPrimary = useNavStore((state) => state.navigatePrimary);

  useEffect(() => {
    if (isMobile) {
      navPrimary('hidden');
    }
  }, [navPrimary, isMobile]);

  useEffect(() => {
    if (clubId && canStart) {
      useChatState.getState().initializeMultiDm(clubId);
    }
  }, [clubId, canStart]);

  const sendMessage = useSendMultiDm(clubId);
  const messages = useMultiDmMessages(clubId);

  if (!club) {
    return null;
  }

  const count = club.team.length;
  const groupName = club.meta.title || club.team.join(', ');

  return (
    <Layout
      className="h-full grow"
      header={
        <div className="flex h-full items-center justify-between border-b-2 border-gray-50 p-2">
          <button
            className={cn(
              'p-2',
              isMobile && '-ml-2 flex items-center rounded-lg hover:bg-gray-50'
            )}
            onClick={() => isMobile && navPrimary('dm')}
            aria-label="Open Messages Menu"
          >
            {isMobile ? (
              <CaretLeftIcon className="mr-1 h-5 w-5 text-gray-500" />
            ) : null}
            <div className="flex items-center space-x-3">
              <MultiDmAvatar img={club.meta.image} />
              <div className="flex flex-col">
                <div className="w-full truncate font-semibold">{groupName}</div>
                <div className="text-gray-600">{`${count} ${pluralize(
                  'Member',
                  count
                )}`}</div>
              </div>
            </div>
          </button>
          {canStart ? <DmOptions ship={clubId} pending={false} /> : null}
        </div>
      }
      aside={<Outlet />}
      footer={
        isAccepted ? (
          <div className="border-t-2 border-gray-50 p-4">
            <ChatInput whom={clubId} sendMessage={sendMessage} />
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
