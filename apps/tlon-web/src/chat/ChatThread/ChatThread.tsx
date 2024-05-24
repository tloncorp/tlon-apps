import { ReplyTuple } from '@tloncorp/shared/dist/urbit/channel';
import { formatUd, unixToDa } from '@urbit/aura';
import bigInt from 'big-integer';
import cn from 'classnames';
import _ from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { Link, useSearchParams } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';
import { useEventListener } from 'usehooks-ts';

import ChatInput from '@/chat/ChatInput/ChatInput';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import ActionMenu from '@/components/ActionMenu';
import useLeap from '@/components/Leap/useLeap';
import MobileHeader from '@/components/MobileHeader';
import useActiveTab, { useNavWithinTab } from '@/components/Sidebar/util';
import VolumeSetting from '@/components/VolumeSetting';
import BranchIcon from '@/components/icons/BranchIcon';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import X16Icon from '@/components/icons/X16Icon';
import keyMap from '@/keyMap';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import {
  useChannelCompatibility,
  useChannelFlag,
  useMarkChannelRead,
} from '@/logic/channel';
import { useBottomPadding } from '@/logic/position';
import { useIsScrolling } from '@/logic/scroll';
import { firstInlineSummary } from '@/logic/tiptap';
import useIsEditingMessage from '@/logic/useIsEditingMessage';
import { useIsMobile } from '@/logic/useMedia';
import {
  useAddReplyMutation,
  useMyLastReply,
  usePerms,
  usePost,
  useReply,
} from '@/state/channel/channel';
import {
  useGroupChannel,
  useRouteGroup,
  useVessel,
} from '@/state/groups/groups';

import ChatScrollerPlaceholder from '../ChatScroller/ChatScrollerPlaceholder';
import { chatStoreLogger, useChatInfo, useChatStore } from '../useChatStore';

export default function ChatThread() {
  const { name, chShip, ship, chName, idTime } = useParams<{
    name: string;
    chShip: string;
    ship: string;
    chName: string;
    idTime: string;
  }>();
  const isMobile = useIsMobile();
  const isEditing = useIsEditingMessage();
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const flag = useChannelFlag()!;
  const nest = `chat/${flag}`;
  const lastReply = useMyLastReply(nest);
  const groupFlag = useRouteGroup();
  const { mutate: sendMessage } = useAddReplyMutation();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const scrollTo = new URLSearchParams(location.search).get('reply');
  const channel = useGroupChannel(groupFlag, nest)!;
  const [searchParams, setSearchParams] = useSearchParams();
  const replyId = useMemo(() => searchParams.get('replyTo'), [searchParams]);
  const reply = useReply(nest, idTime!, replyId || '');
  const replyingWrit: ReplyTuple | undefined =
    reply && replyId ? [bigInt(replyId), reply] : undefined;
  const { isOpen: leapIsOpen } = useLeap();
  const dropZoneId = `chat-thread-input-dropzone-${idTime}`;
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const { post: note, isLoading } = usePost(nest, idTime!);
  const id = note
    ? `${note.essay.author}/${formatUd(unixToDa(note.essay.sent))}`
    : '';
  const msgKey = {
    id,
    time: formatUd(bigInt(idTime!)),
  };
  const chatUnreadsKey = `${flag}/${id}`;
  const { markRead } = useMarkChannelRead(nest, msgKey);
  const replies = note?.seal.replies || null;
  const idTimeIsNumber = !Number.isNaN(Number(idTime));
  if (note && replies !== null && idTimeIsNumber) {
    replies.unshift([
      bigInt(idTime!),
      {
        memo: note.essay,
        revision: note.revision,
        seal: {
          id: note.seal.id,
          'parent-id': note.seal.id,
          reacts: note.seal.reacts,
        },
      },
    ]);
  }
  const orderedReplies = useMemo(
    () =>
      replies?.sort((a, b) => {
        const aTime = a[0];
        const bTime = b[0];
        if (aTime.greater(bTime)) {
          return 1;
        }
        if (aTime.lesser(bTime)) {
          return -1;
        }
        return 0;
      }),
    [replies]
  );
  const { navigate } = useNavWithinTab();
  const threadRef = useRef<HTMLDivElement | null>(null);
  const perms = usePerms(nest);
  const vessel = useVessel(groupFlag, window.our);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);
  const threadTitle = channel?.meta?.title;
  const canWrite =
    perms.writers.length === 0 ||
    _.intersection(perms.writers, vessel.sects).length !== 0;
  const { compatible, text } = useChannelCompatibility(`chat/${flag}`);
  const { paddingBottom } = useBottomPadding();
  const readTimeout = useChatInfo(chatUnreadsKey).unread?.readTimeout;
  const clearOnNavRef = useRef({
    readTimeout,
    chatUnreadsKey,
    markRead,
  });
  const activeTab = useActiveTab();

  const returnURL = useCallback(
    () =>
      `${
        activeTab === 'messages' ? '/dm' : ''
      }/groups/${ship}/${name}/channels/chat/${chShip}/${chName}?msg=${idTime}`,
    [chName, chShip, name, ship, idTime, activeTab]
  );

  const returnURLWithoutMsg = useCallback(
    () =>
      `${
        activeTab === 'messages' ? '/dm' : ''
      }/groups/${ship}/${name}/channels/chat/${chShip}/${chName}`,
    [chName, chShip, name, ship, activeTab]
  );

  const onAtBottom = useCallback(() => {
    const { bottom, delayedRead } = useChatStore.getState();
    bottom(true);
    delayedRead(flag, markRead);
  }, [flag, markRead]);

  const onEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === keyMap.thread.close && !leapIsOpen) {
        navigate(returnURL());
      }
    },
    [navigate, returnURL, leapIsOpen]
  );
  useEventListener('keydown', onEscape, threadRef);

  // read the messages once navigated away
  useEffect(() => {
    clearOnNavRef.current = {
      readTimeout,
      chatUnreadsKey,
      markRead,
    };
  }, [readTimeout, chatUnreadsKey, markRead]);

  useEffect(
    () => () => {
      const curr = clearOnNavRef.current;
      if (curr.readTimeout !== undefined && curr.readTimeout !== 0) {
        chatStoreLogger.log('unmount read from thread');
        useChatStore.getState().read(curr.chatUnreadsKey);
        curr.markRead();
      }
    },
    []
  );

  useEffect(() => {
    if (!idTimeIsNumber) {
      navigate(returnURLWithoutMsg());
    }
  }, [replies, idTimeIsNumber, navigate, returnURLWithoutMsg]);

  const BackButton = isMobile ? Link : 'div';
  const line = note ? firstInlineSummary(note.essay.content) : 'Thread';
  const shortenedLine = line.length > 50 ? `${line.slice(0, 50)}...` : line;

  return (
    <div
      className="padding-bottom-transition relative flex h-full w-full flex-col overflow-y-auto bg-white lg:w-96 lg:border-l-2 lg:border-gray-50"
      ref={threadRef}
      style={{
        paddingBottom,
      }}
    >
      {isMobile ? (
        <MobileHeader
          title={
            <div className="flex w-full items-center justify-center space-x-1">
              <BranchIcon className="h-6 w-6 text-gray-600" />
              <h1 className="text-[17px] text-gray-800">
                Thread
                <span>: {threadTitle}</span>
              </h1>
            </div>
          }
          pathBack={returnURL()}
          action={
            <div className="flex h-12 flex-row items-center justify-end space-x-2">
              <ActionMenu
                open={isMenuOpen}
                onOpenChange={setIsMenuOpen}
                actions={[
                  {
                    key: 'volume',
                    content: (
                      <div className="-mx-2 flex flex-col space-y-6">
                        <div className="flex flex-col space-y-1">
                          <span className="text-lg text-gray-800">
                            Notification Settings
                          </span>
                          <span className="text-[17px] font-normal text-gray-400">
                            {`Thread: ${shortenedLine}`}
                          </span>
                        </div>
                        <VolumeSetting
                          source={{
                            thread: {
                              key: msgKey,
                              channel: nest,
                              group: groupFlag,
                            },
                          }}
                        />
                      </div>
                    ),
                    keepOpenOnClick: true,
                  },
                ]}
              >
                <button
                  className={cn(
                    'default-focus flex h-8 w-8 items-center justify-center rounded text-gray-900 hover:bg-gray-50 sm:h-6 sm:w-6 sm:text-gray-600'
                  )}
                  aria-label="Thread Options"
                  onClick={() => {
                    setIsMenuOpen(true);
                  }}
                >
                  <EllipsisIcon className="h-8 w-8 p-1 sm:h-6 sm:w-6 sm:p-0" />
                </button>
              </ActionMenu>
            </div>
          }
        />
      ) : (
        <header className={'header z-40'}>
          <div
            className={cn(
              'flex items-center justify-between border-b-2 border-gray-50 bg-white py-2 pl-2 pr-4'
            )}
          >
            <BackButton
              to={returnURL()}
              aria-label="Close"
              className={cn(
                'default-focus ellipsis w-max-sm inline-flex h-10 appearance-none items-center justify-center space-x-2 rounded p-2'
              )}
            >
              <div className="flex h-6 w-6 items-center justify-center">
                <BranchIcon className="h-6 w-6 text-gray-600" />
              </div>
              <div className="flex w-full flex-col justify-center">
                <span
                  className={cn(
                    'ellipsis line-clamp-1 text-sm font-bold sm:font-semibold'
                  )}
                >
                  Thread
                </span>
                <span className="line-clamp-1 w-full break-all text-sm text-gray-400">
                  {threadTitle}
                </span>
              </div>
            </BackButton>

            <div className="flex space-x-2">
              {/* <ActionMenu
                open={isMenuOpen}
                onOpenChange={setIsMenuOpen}
                className="max-w-full"
                actions={[
                  {
                    key: 'notifications',
                    onClick: () => {
                      if (isMobile) {
                        // setShowNotifications(true);
                      } else {

                      }
                    },
                    content: 'Notifications',
                  },
                ]}
              > */}
              <button
                className={cn(
                  'default-focus flex h-8 w-8 items-center justify-center rounded text-gray-900 hover:bg-gray-50 sm:h-6 sm:w-6 sm:text-gray-600'
                )}
                aria-label="Thread Options"
                onClick={() => {
                  navigate(
                    `/groups/${groupFlag}/channels/${nest}/message/${idTime}/volume`,
                    true
                  );
                }}
              >
                <EllipsisIcon className="h-8 w-8 p-1 sm:h-6 sm:w-6 sm:p-0" />
              </button>
              {/* </ActionMenu> */}
              <Link
                to={returnURL()}
                aria-label="Close"
                className="icon-button h-6 w-6 bg-transparent"
              >
                <X16Icon className="h-4 w-4 text-gray-600" />
              </Link>
            </div>
          </div>
        </header>
      )}
      <div className="flex flex-1 flex-col overflow-hidden p-0 pr-2">
        {isLoading ? (
          <ChatScrollerPlaceholder count={30} />
        ) : (
          <ChatScroller
            key={idTime}
            messages={orderedReplies || []}
            whom={flag}
            parent={msgKey}
            isLoadingOlder={false}
            isLoadingNewer={false}
            scrollerRef={scrollerRef}
            scrollTo={scrollTo ? bigInt(scrollTo) : undefined}
            scrollElementRef={scrollElementRef}
            isScrolling={isScrolling}
            hasLoadedNewest={false}
            hasLoadedOldest={false}
            onAtBottom={onAtBottom}
          />
        )}
      </div>
      <div
        className={cn(
          isDragging || isOver || !canWrite || (isEditing && isMobile)
            ? ''
            : 'sticky bottom-0 border-t-2 border-gray-50 bg-white p-3 sm:p-4'
        )}
      >
        {compatible && canWrite ? (
          <ChatInput
            whom={flag}
            replying={idTime}
            replyingWrit={replyingWrit}
            sendReply={sendMessage}
            myLastMessage={lastReply}
            showReply
            autoFocus
            dropZoneId={dropZoneId}
            isScrolling={isScrolling}
          />
        ) : !canWrite ? null : (
          <div className="rounded-lg border-2 border-transparent bg-gray-50 px-2 py-1 leading-5 text-gray-600">
            {text}
          </div>
        )}
      </div>
    </div>
  );
}
