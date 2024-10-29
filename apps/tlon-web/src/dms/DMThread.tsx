import { MessageKey } from '@tloncorp/shared/urbit/activity';
import { ReplyTuple } from '@tloncorp/shared/urbit/channel';
import { formatUd } from '@urbit/aura';
import bigInt from 'big-integer';
import cn from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';
import ob from 'urbit-ob';
import { useEventListener } from 'usehooks-ts';

import ChatInput from '@/chat/ChatInput/ChatInput';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import ChatScrollerPlaceholder from '@/chat/ChatScroller/ChatScrollerPlaceholder';
import { useChatStore } from '@/chat/useChatStore';
import useLeap from '@/components/Leap/useLeap';
import MobileHeader from '@/components/MobileHeader';
import BranchIcon from '@/components/icons/BranchIcon';
import X16Icon from '@/components/icons/X16Icon';
import keyMap from '@/keyMap';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { useBottomPadding } from '@/logic/position';
import { useIsScrolling } from '@/logic/scroll';
import { useIsMobile } from '@/logic/useMedia';
import { useMultiDm, useSendReplyMutation, useWrit } from '@/state/chat';

export default function DMThread() {
  const { ship, idTime, idShip } = useParams<{
    ship: string;
    idShip: string;
    idTime: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const scrollTo = new URLSearchParams(location.search).get('reply');
  const whom = ship || '';
  const id = `${idShip!}/${idTime!}`;
  const { writ, isLoading } = useWrit(whom, id);
  const time = useMemo(() => {
    if (!writ) return '0';
    return writ.seal.time;
  }, [writ]);
  const { mutate: sendDmReply } = useSendReplyMutation();
  const { isOpen: leapIsOpen } = useLeap();
  const dropZoneId = `chat-thread-input-dropzone-${id}`;
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);
  const { paddingBottom } = useBottomPadding();
  const msgKey: MessageKey = useMemo(
    () => ({
      id,
      time: formatUd(bigInt(time)),
    }),
    [id, time]
  );

  const isClub = ship ? (ob.isValidPatp(ship) ? false : true) : false;
  const club = useMultiDm(ship || '');
  const threadTitle = isClub ? club?.meta.title || ship : ship;
  const replies = useMemo(() => {
    if (!writ || writ.seal.replies === null) {
      return [] as ReplyTuple[];
    }

    const newReplies = writ.seal.replies;

    newReplies.unshift([
      bigInt(time),
      {
        memo: writ.essay,
        seal: {
          id: writ.seal.id,
          'parent-id': writ.seal.id,
          reacts: writ.seal.reacts,
        },
      },
    ]);

    const sortedReplies = newReplies.sort((a, b) => a[0].compare(b[0]));
    return sortedReplies;
  }, [writ, time]);

  const returnURL = useCallback(() => {
    if (!writ) return '#';

    return `/dm/${ship}?msg=${time}`;
  }, [ship, writ, time]);

  const onEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === keyMap.thread.close && !leapIsOpen) {
        navigate(returnURL());
      }
    },
    [navigate, returnURL, leapIsOpen]
  );

  const onAtBottom = useCallback((atBottom: boolean) => {
    const { threadBottom } = useChatStore.getState();
    threadBottom(atBottom);
  }, []);

  useEventListener('keydown', onEscape, threadRef);

  useEffect(() => {
    useChatStore.getState().threadBottom(true);

    return () => {
      useChatStore.getState().threadBottom(false);
    };
  }, []);

  useEffect(() => {
    useChatStore.getState().setCurrentThread(msgKey);

    return () => {
      useChatStore.getState().setCurrentThread(null);
    };
  }, [msgKey]);

  if (!writ || isLoading) return null;

  const BackButton = isMobile ? Link : 'div';

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-y-auto bg-white lg:w-96 lg:border-l-2 lg:border-gray-50"
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
        {loading ? (
          <ChatScrollerPlaceholder count={30} />
        ) : (
          <ChatScroller
            key={idTime}
            messages={replies}
            whom={whom}
            parent={msgKey}
            isLoadingOlder={false}
            isLoadingNewer={false}
            scrollerRef={scrollerRef}
            scrollTo={scrollTo ? bigInt(scrollTo) : undefined}
            scrollElementRef={scrollElementRef}
            isScrolling={isScrolling}
            hasLoadedNewest={false}
            hasLoadedOldest={false}
            onAtBottomChange={onAtBottom}
          />
        )}
      </div>
      <div
        className={cn(
          isDragging || isOver
            ? ''
            : 'sticky bottom-0 border-t-2 border-gray-50 bg-white p-3 sm:p-4'
        )}
      >
        <div className="safe-area-input">
          <ChatInput
            whom={whom}
            replying={id}
            sendDmReply={sendDmReply}
            showReply={false}
            autoFocus
            dropZoneId={dropZoneId}
            isScrolling={isScrolling}
          />
        </div>
      </div>
    </div>
  );
}
