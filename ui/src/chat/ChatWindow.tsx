import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import _ from 'lodash';
import bigInt from 'big-integer';
import { useMatch, useSearchParams } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';
import ChatUnreadAlerts from '@/chat/ChatUnreadAlerts';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import ArrowS16Icon from '@/components/icons/ArrowS16Icon';
import { useRouteGroup } from '@/state/groups';
import { useCurrentWindow, useInfiniteNotes } from '@/state/channel/channel';
import { useChatInfo, useChatStore } from './useChatStore';
import ChatScrollerPlaceholder from './ChatScroller/ChatScrollerPlaceholder';

interface ChatWindowProps {
  whom: string;
  prefixedElement?: ReactNode;
}

function getScrollTo(msg: string | null) {
  return msg ? bigInt(msg) : undefined;
}

export default function ChatWindow({ whom, prefixedElement }: ChatWindowProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollTo = getScrollTo(searchParams.get('msg'));
  const {
    notes: messages,
    hasNextPage,
    hasPreviousPage,
    fetchPreviousPage,
    fetchNextPage,
    isLoading,
    isFetching,
  } = useInfiniteNotes(`chat/${whom}`, scrollTo?.toString());
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const readTimeout = useChatInfo(whom).unread?.readTimeout;
  const currentWindow = useCurrentWindow(`chat/${whom}`, scrollTo?.toString());

  const goToLatest = useCallback(() => {
    setSearchParams({});
    scrollerRef.current?.scrollToIndex({ index: 'LAST', align: 'end' });
  }, [setSearchParams]);

  useEffect(() => {
    useChatStore.getState().setCurrent(whom);
  }, [whom]);

  // useEffect(
  // () => () => {
  // if (readTimeout !== undefined && readTimeout !== 0) {
  // useChatStore.getState().read(whom);
  // }
  // },
  // [readTimeout, whom]
  // );

  const loadNewerMessages = useCallback(
    (atBottom: boolean) => {
      if (atBottom && hasNextPage && !isFetching) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetching]
  );

  const loadOlderMessages = useCallback(
    (atTop: boolean) => {
      if (atTop && hasPreviousPage && !isFetching) {
        console.log('fetching previous page');
        fetchPreviousPage();
      }
    },
    [fetchPreviousPage, hasPreviousPage, isFetching]
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
      <ChatUnreadAlerts whom={whom} scrollerRef={scrollerRef} />
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
          prefixedElement={prefixedElement}
          scrollTo={scrollTo}
          scrollerRef={scrollerRef}
          atBottomStateChange={loadNewerMessages}
          atTopStateChange={loadOlderMessages}
        />
      </div>
      {/* scrollTo && !currentWindow?.latest ? (
        <div className="absolute bottom-2 left-1/2 z-20 flex w-full -translate-x-1/2 flex-wrap items-center justify-center gap-2">
          <button
            className="button bg-blue-soft text-sm text-blue dark:bg-blue-900 lg:text-base"
            onClick={goToLatest}
          >
            Go to Latest <ArrowS16Icon className="ml-2 h-4 w-4" />
          </button>
        </div>
      ) : null */}
    </div>
  );
}
