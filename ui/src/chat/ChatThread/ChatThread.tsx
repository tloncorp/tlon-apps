import React, { useCallback, useMemo, useRef } from 'react';
import _ from 'lodash';
import cn from 'classnames';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Link, useSearchParams } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';
import { useEventListener } from 'usehooks-ts';
import bigInt from 'big-integer';
import {
  useGroupChannel,
  useRouteGroup,
  useVessel,
} from '@/state/groups/groups';
import ChatInput from '@/chat/ChatInput/ChatInput';
import BranchIcon from '@/components/icons/BranchIcon';
import X16Icon from '@/components/icons/X16Icon';
import useLeap from '@/components/Leap/useLeap';
import { useIsMobile } from '@/logic/useMedia';
import keyMap from '@/keyMap';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { useChannelCompatibility, useChannelFlag } from '@/logic/channel';
import MobileHeader from '@/components/MobileHeader';
import useAppName from '@/logic/useAppName';
import {
  useAddReplyMutation,
  usePost,
  usePerms,
  useReply,
} from '@/state/channel/channel';
import { newReplyMap, ReplyTuple } from '@/types/channel';
import { useIsScrolling } from '@/logic/scroll';
import { useChatInputFocus } from '@/logic/ChatInputFocusContext';
import ChatScrollerPlaceholder from '../ChatScroller/ChatScrollerPlaceholder';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';

export default function ChatThread() {
  const { name, chShip, ship, chName, idTime } = useParams<{
    name: string;
    chShip: string;
    ship: string;
    chName: string;
    idTime: string;
  }>();
  const isMobile = useIsMobile();
  const { isChatInputFocused } = useChatInputFocus();
  const appName = useAppName();
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const flag = useChannelFlag()!;
  const nest = `chat/${flag}`;
  const groupFlag = useRouteGroup();
  const { mutate: sendMessage } = useAddReplyMutation();
  const location = useLocation();
  const scrollTo = new URLSearchParams(location.search).get('msg');
  const channel = useGroupChannel(groupFlag, nest)!;
  const [searchParams, setSearchParams] = useSearchParams();
  const replyId = useMemo(() => searchParams.get('reply'), [searchParams]);
  const reply = useReply(nest, idTime!, replyId || '');
  const replyingWrit: ReplyTuple | undefined =
    reply && replyId ? [bigInt(replyId), reply] : undefined;
  const { isOpen: leapIsOpen } = useLeap();
  const dropZoneId = `chat-thread-input-dropzone-${idTime}`;
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const { post: note, isLoading } = usePost(nest, idTime!);
  const replies = note.seal.replies ?? newReplyMap();
  replies.set(bigInt(idTime!), {
    memo: note.essay,
    seal: {
      id: note.seal.id,
      'parent-id': note.seal.id,
      reacts: note.seal.reacts,
    },
  });
  const navigate = useNavigate();
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
  const shouldApplyPaddingBottom = isMobile && !isChatInputFocused;

  const returnURL = useCallback(
    () =>
      `/groups/${ship}/${name}/channels/chat/${chShip}/${chName}?msg=${idTime}`,
    [chName, chShip, name, ship, idTime]
  );

  const onEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === keyMap.thread.close && !leapIsOpen) {
        navigate(returnURL());
      }
    },
    [navigate, returnURL, leapIsOpen]
  );
  useEventListener('keydown', onEscape, threadRef);

  const BackButton = isMobile ? Link : 'div';

  return (
    <div
      className="padding-bottom-transition relative flex h-full w-full flex-col overflow-y-auto bg-white lg:w-96 lg:border-l-2 lg:border-gray-50"
      ref={threadRef}
      style={{
        paddingBottom: shouldApplyPaddingBottom ? 50 : 0,
      }}
    >
      {isMobile ? (
        <MobileHeader
          title={
            <div className="flex w-full items-center justify-center space-x-1">
              <BranchIcon className="h-6 w-6 text-gray-600" />
              <h1 className="text-[17px] text-gray-800">
                Thread
                {appName === 'Groups' && <span>: {threadTitle}</span>}
              </h1>
            </div>
          }
          pathBack={returnURL()}
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
                    'ellipsis text-sm font-bold line-clamp-1 sm:font-semibold'
                  )}
                >
                  Thread
                </span>
                <span className="w-full break-all text-sm text-gray-400 line-clamp-1">
                  {threadTitle}
                </span>
              </div>
            </BackButton>

            <Link
              to={returnURL()}
              aria-label="Close"
              className="icon-button h-6 w-6 bg-transparent"
            >
              <X16Icon className="h-4 w-4 text-gray-600" />
            </Link>
          </div>
        </header>
      )}
      <div className="flex flex-1 flex-col overflow-hidden p-0 pr-2">
        {isLoading ? (
          <ChatScrollerPlaceholder count={30} />
        ) : (
          <ChatScroller
            key={idTime}
            messages={replies.toArray()}
            fetchState={'initial'}
            whom={nest}
            scrollerRef={scrollerRef}
            scrollTo={scrollTo ? bigInt(scrollTo) : undefined}
            scrollElementRef={scrollElementRef}
            isScrolling={isScrolling}
          />
        )}
      </div>
      <div
        className={cn(
          isDragging || isOver || !canWrite
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
            showReply
            autoFocus
            dropZoneId={dropZoneId}
            isScrolling={isScrolling}
          />
        ) : !canWrite ? null : (
          <div className="rounded-lg border-2 border-transparent bg-gray-50 py-1 px-2 leading-5 text-gray-600">
            {text}
          </div>
        )}
      </div>
    </div>
  );
}
