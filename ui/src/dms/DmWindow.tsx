import React, {
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import bigInt from 'big-integer';
import { useSearchParams } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';
import DMUnreadAlerts from '@/chat/DMUnreadAlerts';
import {
  useChatLoading,
  useChatState,
  useInfiniteDMs,
  useMessagesForChat,
  useWritWindow,
} from '@/state/chat';
import ArrowS16Icon from '@/components/icons/ArrowS16Icon';
import { log } from '@/logic/utils';
import { useChatInfo, useChatStore } from '@/chat/useChatStore';
import ChatScrollerPlaceholder from '@/chat/ChatScroller/ChatScrollerPlaceholder';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import { useIsScrolling } from '@/logic/scroll';
import { STANDARD_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import { newWritMap } from '@/types/dms';

interface DmWindowProps {
  whom: string;
  root: string;
  prefixedElement?: ReactElement;
}

function getScrollTo(msg: string | null) {
  return msg ? bigInt(msg) : undefined;
}

export default function DmWindow({
  whom,
  root,
  prefixedElement,
}: DmWindowProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollTo = getScrollTo(searchParams.get('msg'));
  const messages = useMessagesForChat(whom, scrollTo?.toString());
  const window = useWritWindow(whom);
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const readTimeout = useChatInfo(whom).unread?.readTimeout;
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);

  const {
    writs,
    hasNextPage,
    hasPreviousPage,
    isLoading,
    fetchNextPage,
    fetchPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
  } = useInfiniteDMs(whom, scrollTo?.toString());

  const fetchState = useMemo(
    () =>
      isFetchingNextPage
        ? 'bottom'
        : isFetchingPreviousPage
        ? 'top'
        : 'initial',
    [isFetchingNextPage, isFetchingPreviousPage]
  );

  const onAtBottom = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      log('fetching next page');
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const onAtTop = useCallback(() => {
    if (hasPreviousPage && !isFetchingPreviousPage) {
      log('fetching previous page');
      fetchPreviousPage();
    }
  }, [fetchPreviousPage, hasPreviousPage, isFetchingPreviousPage]);

  const goToLatest = useCallback(() => {
    setSearchParams({});
    scrollerRef.current?.scrollToIndex({ index: 'LAST', align: 'end' });
  }, [setSearchParams]);

  useEffect(() => {
    useChatStore.getState().setCurrent(whom);
  }, [whom]);

  // read the messages once navigated away
  useEffect(
    () => () => {
      if (readTimeout !== undefined && readTimeout !== 0) {
        useChatStore.getState().read(whom);
      }
    },
    [readTimeout, whom]
  );

  // TODO: confirm the new placeholder works
  // if (isLoading) {
  //   return (
  //     <div className="h-full overflow-hidden">
  //       <ChatScrollerPlaceholder count={30} />
  //     </div>
  //   );
  // }

  return (
    <div className="relative h-full">
      <DMUnreadAlerts whom={whom} root={root} />
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
          // messages={messages}
          messages={writs}
          fetchState={fetchState}
          whom={whom}
          scrollTo={scrollTo}
          scrollerRef={scrollerRef}
          scrollElementRef={scrollElementRef}
          isScrolling={isScrolling}
          topLoadEndMarker={prefixedElement}
          onAtTop={onAtTop}
          onAtBottom={onAtBottom}
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
