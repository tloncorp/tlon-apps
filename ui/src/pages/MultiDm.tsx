import React, { useCallback, useEffect } from 'react';
import cn from 'classnames';
import { Outlet, useParams } from 'react-router';
import ChatInput from '../chat/ChatInput/ChatInput';
import Layout from '../components/Layout/Layout';
import { useChatState, useMultiDmMessages } from '../state/chat';
import ChatWindow from '../chat/ChatWindow';
import DmInvite from './DmInvite';
import Avatar from '../components/Avatar';
import DmOptions from '../dms/DMOptions';
import { useContact, useContacts } from '../state/contact';
import CaretLeftIcon from '../components/icons/CaretLeftIcon';
import { useIsMobile } from '../logic/useMedia';
import DMHero from '../dms/DMHero';
import useNavStore from '../components/Nav/useNavStore';
import GroupIcon from '../components/icons/GroupIcon';

export default function MultiDm() {
  const clubId = useParams<{ ship: string }>().ship!;
  const contacts = useContacts();
  // TODO: Where is the club membership stored?
  const contactNames = Object.keys(contacts);

  const contact = useContact(clubId);
  const isMobile = useIsMobile();

  // TODO: when is a Multi DM "accepted"? when one member joins? when all? or always?
  // const isAccepted = !useDmIsPending(clubId);
  const isAccepted = false;

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
  const messages = useMultiDmMessages(clubId);

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
              <GroupIcon />
              <div className="flex flex-col">
                {/* TODO: prefer title, otherwise show list of patps, get # members */}
                <span className="font-semibold">{clubId}</span>
                <span className="text-gray-600">4 Members</span>
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
            <ChatInput whom={clubId} />
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
              <DMHero ship={clubId} contact={contact} />
            </div>
          }
        />
      ) : (
        <DmInvite ship={clubId} />
      )}
    </Layout>
  );
}
