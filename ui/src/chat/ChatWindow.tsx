import React, { ReactElement, useCallback, useEffect, useRef } from 'react';
import _ from 'lodash';
import bigInt from 'big-integer';
import { useMatch, useSearchParams } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';
import ChatUnreadAlerts from '@/chat/ChatUnreadAlerts';
import {
  useChatLoading,
  useChatState,
  useMessagesForChat,
  useWritWindow,
} from '@/state/chat';
import { useRouteGroup } from '@/state/groups';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import ArrowS16Icon from '@/components/icons/ArrowS16Icon';
import { useChatInfo, useChatStore } from './useChatStore';
import ChatScrollerPlaceholder from './ChatScroller/ChatScrollerPlaceholder';

interface ChatWindowProps {
  whom: string;
  root: string;
  prefixedElement?: ReactElement;
  scrollElementRef: React.RefObject<HTMLDivElement>;
  isScrolling: boolean;
}

function getScrollTo(
  whom: string,
  thread: ReturnType<typeof useMatch>,
  msg: string | null
) {
  if (thread) {
    const { idShip, idTime } = thread.params;
    return useChatState.getState().getTime(whom, `${idShip}/${idTime}`);
  }

  return msg ? bigInt(msg) : undefined;
}

export default function ChatWindow({
  whom,
  root,
  prefixedElement,
  scrollElementRef,
  isScrolling,
}: ChatWindowProps) {
  const flag = useRouteGroup();
  const thread = useMatch(
    `/groups/${flag}/channels/chat/${whom}/message/:idShip/:idTime`
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const msg = searchParams.get('msg');
  const scrollTo = getScrollTo(whom, thread, msg);
  const isLoading = useChatLoading(whom);
  const messages = useMessagesForChat(whom, scrollTo);
  const window = useWritWindow(whom);
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const readTimeout = useChatInfo(whom).unread?.readTimeout;

  const goToLatest = useCallback(() => {
    setSearchParams({});
    scrollerRef.current?.scrollToIndex({ index: 'LAST', align: 'end' });
  }, [setSearchParams]);

  useEffect(() => {
    if (scrollTo && !thread) {
      useChatState.getState().fetchMessagesAround(whom, '25', scrollTo);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo?.toString(), thread]);

  useEffect(() => {
    useChatStore.getState().setCurrent(whom);
  }, [whom]);

  useEffect(
    () => () => {
      if (readTimeout !== undefined && readTimeout !== 0) {
        useChatStore.getState().read(whom);
      }
    },
    [readTimeout, whom]
  );

  if (isLoading) {
    return (
      <div className="h-full overflow-hidden">
        <ChatScrollerPlaceholder count={30} />
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <ChatUnreadAlerts whom={whom} root={root} />
      <div className="flex h-full w-full flex-col overflow-hidden">
        <ChatScroller
          /**
           * key=whom forces a remount for each channel switch
           * This resets the scroll position when switching channels;
           * previously, when switching between channels, the virtuoso
           * internal scroll index would remain the same. So, if one scrolled
           * far back in a long channel, then switched to a less active one,
           * the channel would be scrolled to the top.
           */
          key={whom}
          messages={messages}
          whom={whom}
          topLoadEndMarker={prefixedElement}
          scrollTo={scrollTo}
          scrollerRef={scrollerRef}
          scrollElementRef={scrollElementRef}
          isScrolling={isScrolling}
        />
      </div>
      {scrollTo && !window?.latest ? (
        <div className="absolute bottom-2 left-1/2 z-20 flex w-full -translate-x-1/2 flex-wrap items-center justify-center gap-2">
          <button
            className="button bg-blue-soft text-sm text-blue dark:bg-blue-900 lg:text-base"
            onClick={goToLatest}
          >
            Go to Latest <ArrowS16Icon className="ml-2 h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
