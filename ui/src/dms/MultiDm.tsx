import React, { useEffect, useRef } from 'react';
import cn from 'classnames';
import { Outlet, Route, Routes, useMatch, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import { useChatState, useMultiDm, useMultiDmIsPending } from '@/state/chat';
import { useIsMobile } from '@/logic/useMedia';
import { pluralize } from '@/logic/utils';
import useMessageSelector from '@/logic/useMessageSelector';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import { Club } from '@/types/dms';
import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import MagnifyingGlassMobileNavIcon from '@/components/icons/MagnifyingGlassMobileNavIcon';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import useAppName from '@/logic/useAppName';
import MobileHeader from '@/components/MobileHeader';
import DmWindow from '@/dms/DmWindow';
import { useChatInputFocus } from '@/logic/ChatInputFocusContext';
import { useIsScrolling } from '@/logic/scroll';
import MultiDmInvite from './MultiDmInvite';
import MultiDmAvatar from './MultiDmAvatar';
import MultiDmHero from './MultiDmHero';
import DmOptions from './DMOptions';
import MessageSelector from './MessageSelector';
import PendingIndicator from './MultiDMPendingIndicator';
import DmSearch from './DmSearch';

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
  const { isChatInputFocused } = useChatInputFocus();
  const dropZoneId = `chat-dm-input-dropzone-${clubId}`;
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const isMobile = useIsMobile();
  const inSearch = useMatch(`/dm/${clubId}/search/*`);
  const isAccepted = !useMultiDmIsPending(clubId);
  const club = useMultiDm(clubId);
  const appName = useAppName();
  const groupName = club?.meta.title || club?.team.concat(club.hive).join(', ');
  const root = `/dm/${clubId}`;
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);
  const shouldApplyPaddingBottom = isMobile && !isChatInputFocused;

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
        style={{
          paddingBottom: shouldApplyPaddingBottom ? 50 : 0,
        }}
        className="padding-bottom-transition flex-1"
        header={
          isSelecting ? (
            <MessageSelector />
          ) : (
            <Routes>
              <Route
                path="search/:query?"
                element={
                  <DmSearch
                    whom={clubId}
                    root={root}
                    placeholder="Search Messages"
                  >
                    <TitleButton club={club} isMobile={isMobile} />
                  </DmSearch>
                }
              />
              <Route
                path="*"
                element={
                  isMobile ? (
                    <MobileHeader
                      title={
                        <DmOptions
                          className="w-full"
                          whom={clubId}
                          isMulti
                          pending={!isAccepted}
                        >
                          <button className="flex w-full items-center justify-center">
                            <div className="flex h-6 w-6 flex-none items-center justify-center rounded text-center">
                              <MultiDmAvatar {...club.meta} size="xs" />
                            </div>
                            <h1 className="ml-2 flex overflow-hidden">
                              <span className="truncate">{groupName}</span>
                            </h1>
                          </button>
                        </DmOptions>
                      }
                      pathBack={
                        appName === 'Groups' && isMobile ? '/messages' : '/'
                      }
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
                      <TitleButton club={club} isMobile={isMobile} />
                      <div className="flex shrink-0 flex-row items-center space-x-3">
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
                        />
                      </div>
                    </div>
                  )
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
                sendDm={isSelecting ? sendDmFromMessageSelector : sendMessage}
                showReply
                autoFocus={!isSelecting && !inSearch}
                dropZoneId={dropZoneId}
                isScrolling={isScrolling}
              />
            </div>
          ) : null
        }
      >
        {isAccepted ? (
          <DmWindow
            whom={clubId}
            root={root}
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
