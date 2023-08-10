import React, { useEffect } from 'react';
import cn from 'classnames';
import { Outlet, Route, Routes, useMatch, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import { useChatState, useMultiDm, useMultiDmIsPending } from '@/state/chat';
import ChatWindow from '@/chat/ChatWindow';
import { useIsMobile } from '@/logic/useMedia';
import { pluralize } from '@/logic/utils';
import useMessageSelector from '@/logic/useMessageSelector';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import { Club } from '@/types/chat';
import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import ChatSearch from '@/chat/ChatSearch/ChatSearch';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import useAppName from '@/logic/useAppName';
import MultiDmInvite from './MultiDmInvite';
import MultiDmAvatar from './MultiDmAvatar';
import MultiDmHero from './MultiDmHero';
import DmOptions from './DMOptions';
import MessageSelector from './MessageSelector';
import PendingIndicator from './MultiDMPendingIndicator';

function TitleButton({ club, isMobile }: { club: Club; isMobile: boolean }) {
  const count = club.team.length;
  const hasPending = club.hive.length > 0;
  const groupName = club.meta.title || club.team.concat(club.hive).join(', ');
  const BackButton = isMobile ? Link : 'div';
  const appName = useAppName();

  return (
    <BackButton
      to={appName === 'Groups' && isMobile ? '/messages' : '/'}
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
        <MultiDmAvatar {...club.meta} size="xs" />
      </div>
      <div className="flex w-full flex-col justify-center">
        <span
          className={cn(
            'ellipsis text-sm font-bold line-clamp-1 sm:font-semibold'
          )}
        >
          {groupName}
        </span>
        <span className="w-full break-all text-sm text-gray-400 line-clamp-1">
          <span>{`${count} ${pluralize('Member', count)}${
            hasPending ? ',' : ''
          }`}</span>
          {hasPending ? <PendingIndicator hive={club.hive} /> : null}
        </span>
      </div>
    </BackButton>
  );
}

export default function MultiDm() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const clubId = useParams<{ ship: string }>().ship!;
  const dropZoneId = `chat-dm-input-dropzone-${clubId}`;
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const isMobile = useIsMobile();
  const inSearch = useMatch(`/dm/${clubId}/search/*`);
  const isAccepted = !useMultiDmIsPending(clubId);
  const club = useMultiDm(clubId);

  const {
    isSelectingMessage,
    sendDm: sendDmFromMessageSelector,
    existingMultiDm,
  } = useMessageSelector();

  const isSelecting = isSelectingMessage && existingMultiDm === clubId;

  useEffect(() => {
    if (clubId && club) {
      useChatState.getState().initializeMultiDm(clubId);
    }
  }, [clubId, club]);

  const { sendMessage } = useChatState.getState();

  if (!club) {
    return null;
  }

  return (
    <>
      <Layout
        className="flex-1"
        header={
          isSelecting ? (
            <MessageSelector />
          ) : (
            <Routes>
              <Route
                path="search/:query?"
                element={
                  <ChatSearch
                    whom={clubId}
                    root={`/dm/${clubId}`}
                    placeholder="Search Messages"
                  >
                    <TitleButton club={club} isMobile={isMobile} />
                  </ChatSearch>
                }
              />
              <Route
                path="*"
                element={
                  <div className="flex items-center justify-between border-b-2 border-gray-50 bg-white py-2 pl-2 pr-4">
                    <TitleButton club={club} isMobile={isMobile} />
                    <div className="flex shrink-0 flex-row items-center space-x-3">
                      {isMobile && <ReconnectingSpinner />}
                      <Link
                        to="search/"
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-50"
                        aria-label="Search Chat"
                      >
                        <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
                      </Link>
                      <DmOptions
                        whom={clubId}
                        pending={!isAccepted}
                        isMulti
                        alwaysShowEllipsis
                        className="text-gray-600"
                      />
                    </div>
                  </div>
                }
              />
            </Routes>
          )
        }
        footer={
          isAccepted ? (
            <div
              className={cn(
                isDragging || isOver ? '' : 'border-t-2 border-gray-50 p-4'
              )}
            >
              <ChatInput
                key={clubId}
                whom={clubId}
                sendMessage={
                  isSelecting ? sendDmFromMessageSelector : sendMessage
                }
                showReply
                autoFocus={!isSelecting && !inSearch}
                dropZoneId={dropZoneId}
              />
            </div>
          ) : null
        }
      >
        {isAccepted ? (
          <ChatWindow
            whom={clubId}
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
