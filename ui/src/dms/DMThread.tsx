import React, { useCallback, useMemo, useRef, useState } from 'react';
import ob from 'urbit-ob';
import cn from 'classnames';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';
import { useEventListener } from 'usehooks-ts';
import bigInt from 'big-integer';
import { useChatState, useWrit } from '@/state/chat';
import ChatInput from '@/chat/ChatInput/ChatInput';
import BranchIcon from '@/components/icons/BranchIcon';
import X16Icon from '@/components/icons/X16Icon';
import useLeap from '@/components/Leap/useLeap';
import { useIsMobile } from '@/logic/useMedia';
import keyMap from '@/keyMap';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import MobileHeader from '@/components/MobileHeader';
import useAppName from '@/logic/useAppName';
import ChatScrollerPlaceholder from '@/chat/ChatScroller/ChatScrollerPlaceholder';
import ReplyScroller from '@/replies/ReplyScroller/ReplyScroller';
import { newReplyMap } from '@/types/channel';

export default function DMThread() {
  const { chShip, ship, chName, idTime, idShip } = useParams<{
    chShip: string;
    ship: string;
    chName: string;
    idShip: string;
    idTime: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const appName = useAppName();
  const [loading, setLoading] = useState(false);
  const scrollTo = new URLSearchParams(location.search).get('msg');
  const whom = ship || '';
  const id = `${idShip!}/${idTime!}`;
  const { writ, isLoading } = useWrit(whom, id);
  const time = useMemo(() => {
    if (!writ) return '0';
    return writ.seal.time;
  }, [writ]);
  const { sendMessage } = useChatState.getState();
  const { isOpen: leapIsOpen } = useLeap();
  const dropZoneId = `chat-thread-input-dropzone-${id}`;
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const isClub = ship ? (ob.isValidPatp(ship) ? false : true) : false;
  const club = ship && isClub ? useChatState.getState().multiDms[ship] : null;
  const threadTitle = isClub ? club?.meta.title || ship : ship;
  const replies = useMemo(() => {
    if (!writ || writ.seal.replies === null) {
      return newReplyMap();
    }

    return writ.seal.replies.with(bigInt(time), {
      memo: writ.essay,
      seal: {
        id: writ.seal.id,
        'parent-id': writ.seal.id,
        reacts: writ.seal.reacts,
      },
    });
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

  useEventListener('keydown', onEscape, threadRef);

  if (!writ || isLoading) return null;

  const BackButton = isMobile ? Link : 'div';

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-y-auto bg-white lg:w-96 lg:border-l-2 lg:border-gray-50"
      ref={threadRef}
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
        {loading ? (
          <ChatScrollerPlaceholder count={30} />
        ) : (
          <ReplyScroller
            parentPost={writ}
            key={idTime}
            messages={replies}
            whom={whom}
            scrollerRef={scrollerRef}
            scrollTo={scrollTo ? bigInt(scrollTo) : undefined}
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
            sendDm={sendMessage}
            showReply={false}
            autoFocus
            dropZoneId={dropZoneId}
          />
        </div>
      </div>
    </div>
  );
}
