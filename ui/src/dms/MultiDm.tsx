import React, { useCallback, useRef } from 'react';
import cn from 'classnames';
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
import Layout from '@/components/Layout/Layout';
import { useMultiDm, useMultiDmIsPending, useSendMessage } from '@/state/chat';
import { useIsMobile } from '@/logic/useMedia';
import { dmListPath, pluralize } from '@/logic/utils';
import useMessageSelector from '@/logic/useMessageSelector';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import { Club } from '@/types/dms';
import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import MagnifyingGlassMobileNavIcon from '@/components/icons/MagnifyingGlassMobileNavIcon';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import MobileHeader from '@/components/MobileHeader';
import DmWindow from '@/dms/DmWindow';
import { useChatInputFocus } from '@/logic/ChatInputFocusContext';
import { useIsScrolling } from '@/logic/scroll';
import { useNegotiateMulti } from '@/state/negotiation';
import ClubName from '@/components/ClubName';
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
  const BackButton = isMobile ? Link : 'div';

  return (
    <BackButton
      to={isMobile ? '/messages' : '/'}
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
            'ellipsis line-clamp-1 text-sm font-bold sm:font-semibold'
          )}
        >
          <ClubName club={club} />
        </span>
        <span className="line-clamp-1 w-full break-all text-sm text-gray-400">
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
  const navigate = useNavigate();
  const inSearch = useMatch(`/dm/${clubId}/search/*`);
  const isAccepted = !useMultiDmIsPending(clubId);
  const club = useMultiDm(clubId);
  const root = `/dm/${clubId}`;
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);
  const shouldApplyPaddingBottom = isMobile && !isChatInputFocused;
  const dmParticipants = [...(club?.team ?? []), ...(club?.hive ?? [])];
  const { match: negotiationMatch, isLoading: negotiationLoading } =
    useNegotiateMulti(dmParticipants, 'chat', 'chat');
  const confirmedMismatch = !negotiationLoading && !negotiationMatch;
  const { mutate: sendMessage } = useSendMessage();

  const {
    isSelectingMessage,
    sendDm: sendDmFromMessageSelector,
    existingMultiDm,
  } = useMessageSelector();

  const isSelecting = isSelectingMessage && existingMultiDm === clubId;

  const handleLeave = useCallback(() => {
    navigate(dmListPath);
  }, [navigate]);

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
            <>
              {isMobile && (
                <MobileHeader title="New Message" pathBack={dmListPath} />
              )}
              <MessageSelector />
            </>
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
                          onLeave={handleLeave}
                        >
                          <button className="flex w-full items-center justify-center">
                            <div className="flex h-6 w-6 flex-none items-center justify-center rounded text-center">
                              <MultiDmAvatar {...club.meta} size="xs" />
                            </div>
                            <h1 className="ml-2 flex overflow-hidden">
                              <span className="truncate">
                                <ClubName club={club} />
                              </span>
                            </h1>
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
                          onLeave={handleLeave}
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
          <div
            className={cn(
              isDragging || isOver ? '' : 'border-t-2 border-gray-50 p-4'
            )}
          >
            {isAccepted && !confirmedMismatch ? (
              <ChatInput
                key={clubId}
                whom={clubId}
                sendDm={isSelecting ? sendDmFromMessageSelector : sendMessage}
                showReply
                autoFocus={!isSelecting && !inSearch}
                dropZoneId={dropZoneId}
                isScrolling={isScrolling}
              />
            ) : confirmedMismatch ? (
              <div className="rounded-lg border-2 border-transparent bg-gray-50 px-2 py-1 leading-5 text-gray-600">
                Your version of the app does not match some of the members of
                this chat.
              </div>
            ) : null}
          </div>
        }
      >
        {isAccepted ? (
          <DmWindow
            whom={clubId}
            root={root}
            prefixedElement={
              <div className="pb-12 pt-4">
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
