import React, { useCallback, useEffect, useRef, useState } from 'react';
import _ from 'lodash';
import ob from 'urbit-ob';
import { udToDec } from '@urbit/api';
import cn from 'classnames';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';
import { useEventListener } from 'usehooks-ts';
import bigInt from 'big-integer';
import { useChatState, useReplies, useWrit, useChatPerms } from '@/state/chat';
import { useChannel, useRouteGroup, useVessel } from '@/state/groups/groups';
import ChatInput from '@/chat/ChatInput/ChatInput';
import BranchIcon from '@/components/icons/BranchIcon';
import X16Icon from '@/components/icons/X16Icon';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import { whomIsFlag } from '@/logic/utils';
import useLeap from '@/components/Leap/useLeap';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import { useIsMobile } from '@/logic/useMedia';
import keyMap from '@/keyMap';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { useChannelCompatibility, useChannelFlag } from '@/logic/channel';
import ChatScrollerPlaceholder from '../ChatScroller/ChatScrollerPlaceholder';

export default function ChatThread() {
  const { name, chShip, ship, chName, idTime, idShip } = useParams<{
    name: string;
    chShip: string;
    ship: string;
    chName: string;
    idShip: string;
    idTime: string;
  }>();
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const flag = useChannelFlag()!;
  const whom = flag || ship || '';
  const groupFlag = useRouteGroup();
  const { sendMessage } = useChatState.getState();
  const location = useLocation();
  const scrollTo = new URLSearchParams(location.search).get('msg');
  const channel = useChannel(groupFlag, `chat/${flag}`)!;
  const { isOpen: leapIsOpen } = useLeap();
  const id = `${idShip!}/${idTime!}`;
  const dropZoneId = `chat-thread-input-dropzone-${id}`;
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const maybeWrit = useWrit(whom, id);
  const replies = useReplies(whom, id);
  const navigate = useNavigate();
  const [time, writ] = maybeWrit ?? [null, null];
  const threadRef = useRef<HTMLDivElement | null>(null);
  const perms = useChatPerms(flag);
  const vessel = useVessel(groupFlag, window.our);
  const isClub = ship ? (ob.isValidPatp(ship) ? false : true) : false;
  const club = ship && isClub ? useChatState.getState().multiDms[ship] : null;
  const threadTitle = whomIsFlag(whom)
    ? channel?.meta?.title || ''
    : isClub
    ? club?.meta.title || ship
    : ship;
  const canWrite =
    perms.writers.length === 0 ||
    _.intersection(perms.writers, vessel.sects).length !== 0;
  const { compatible, text } = useChannelCompatibility(`chat/${flag}`);

  const returnURL = useCallback(() => {
    if (!time || !writ) return '#';

    if (location.pathname.includes('groups')) {
      return `/groups/${ship}/${name}/channels/chat/${chShip}/${chName}?msg=${time.toString()}`;
    }
    return `/dm/${ship}?msg=${time.toString()}`;
  }, [chName, chShip, location, name, ship, time, writ]);

  const onEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === keyMap.thread.close && !leapIsOpen) {
        navigate(returnURL());
      }
    },
    [navigate, returnURL, leapIsOpen]
  );

  useEventListener('keydown', onEscape, threadRef);

  const initializeChannel = useCallback(async () => {
    setLoading(true);
    if (!idTime) return;
    await useChatState
      .getState()
      .fetchMessagesAround(
        `${chShip}/${chName}`,
        '50',
        bigInt(udToDec(idTime))
      );
    setLoading(false);
  }, [chName, chShip, idTime]);

  useEffect(() => {
    if (!time || !writ) {
      initializeChannel();
    }
  }, [initializeChannel, time, writ]);

  if (!time || !writ) return null;

  const thread = replies.with(time, writ);
  const BackButton = isMobile ? Link : 'div';

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-y-auto bg-white lg:w-96 lg:border-l-2 lg:border-gray-50"
      ref={threadRef}
    >
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
            {isMobile ? (
              <div className="flex h-6 w-6 items-center justify-center">
                <CaretLeft16Icon className="h-5 w-5 shrink-0 text-gray-600" />
              </div>
            ) : null}
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

          {!isMobile && (
            <Link
              to={returnURL()}
              aria-label="Close"
              className="icon-button h-6 w-6 bg-transparent"
            >
              <X16Icon className="h-4 w-4 text-gray-600" />
            </Link>
          )}
        </div>
      </header>
      <div className="flex flex-1 flex-col p-0 pr-2">
        {loading ? (
          <ChatScrollerPlaceholder count={30} />
        ) : (
          <ChatScroller
            key={idTime}
            messages={thread}
            whom={whom}
            scrollerRef={scrollerRef}
            replying
            scrollTo={scrollTo ? bigInt(scrollTo) : undefined}
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
            whom={whom}
            replying={id}
            sendMessage={sendMessage}
            inThread
            autoFocus
            dropZoneId={dropZoneId}
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
