import React, {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import bigInt from 'big-integer';
import { useSearchParams } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';
import ChatUnreadAlerts from '@/chat/ChatUnreadAlerts';
import ArrowS16Icon from '@/components/icons/ArrowS16Icon';
import { log } from '@/logic/utils';
import { useInfinitePosts, useMarkReadMutation } from '@/state/channel/channel';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import { useChannelCompatibility } from '@/logic/channel';
import EmptyPlaceholder from '@/components/EmptyPlaceholder';
import { useChatInfo, useChatStore } from './useChatStore';
import ChatScrollerPlaceholder from './ChatScroller/ChatScrollerPlaceholder';

interface ChatWindowProps {
  whom: string;
  root: string;
  prefixedElement?: ReactElement;
  scrollElementRef: React.RefObject<HTMLDivElement>;
  isScrolling: boolean;
}

function getScrollTo(msg: string | null) {
  return msg ? bigInt(msg) : undefined;
}

export default function ChatWindow({
  whom,
  root,
  prefixedElement,
  scrollElementRef,
  isScrolling,
}: ChatWindowProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [shouldGetLatest, setShouldGetLatest] = useState(false);
  const scrollTo = getScrollTo(searchParams.get('msg'));
  const nest = `chat/${whom}`;
  const {
    posts: messages,
    hasNextPage,
    hasPreviousPage,
    fetchPreviousPage,
    refetch,
    fetchNextPage,
    isLoading,
    isFetchingNextPage,
    isFetchingPreviousPage,
  } = useInfinitePosts(nest, scrollTo?.toString(), shouldGetLatest);
  const { mutate: markRead } = useMarkReadMutation();
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const readTimeout = useChatInfo(nest).unread?.readTimeout;
  const fetchState = useMemo(
    () =>
      isFetchingNextPage
        ? 'bottom'
        : isFetchingPreviousPage
        ? 'top'
        : 'initial',
    [isFetchingNextPage, isFetchingPreviousPage]
  );
  const { compatible } = useChannelCompatibility(nest);
  const latestMessageIndex = messages.length - 1;
  const scrollToIndex = useMemo(
    () =>
      scrollTo
        ? messages.findIndex((m) => m[0].eq(scrollTo))
        : latestMessageIndex,
    [scrollTo, messages, latestMessageIndex]
  );
  const latestIsMoreThan30NewerThanScrollTo = useMemo(
    () =>
      scrollToIndex !== latestMessageIndex &&
      latestMessageIndex - scrollToIndex > 30,
    [scrollToIndex, latestMessageIndex]
  );

  const goToLatest = useCallback(async () => {
    setSearchParams({});
    if (hasNextPage) {
      await refetch();
      setShouldGetLatest(false);
    } else {
      scrollerRef.current?.scrollToIndex({ index: 'LAST', align: 'end' });
    }
  }, [setSearchParams, refetch, hasNextPage, scrollerRef]);

  useEffect(() => {
    useChatStore.getState().setCurrent(nest);

    return () => {
      useChatStore.getState().setCurrent('');
    };
  }, [nest]);

  const onAtBottom = useCallback(() => {
    const { bottom, delayedRead } = useChatStore.getState();
    bottom(true);
    delayedRead(nest, () => markRead({ nest }));
    if (hasPreviousPage && !isFetchingPreviousPage) {
      console.log('fetching next page');
      log('fetching next page');
      fetchPreviousPage();
    }
  }, [
    nest,
    markRead,
    fetchPreviousPage,
    hasPreviousPage,
    isFetchingPreviousPage,
  ]);

  const onAtTop = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      console.log('fetching previous page');
      log('fetching previous page');
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(
    () => () => {
      if (readTimeout !== undefined && readTimeout !== 0) {
        useChatStore.getState().read(nest);
        markRead({ nest });
      }
    },
    [readTimeout, nest, markRead]
  );

  useEffect(() => {
    if (scrollTo && hasNextPage) {
      setShouldGetLatest(true);
    }
  }, [scrollTo, hasNextPage]);

  if (isLoading) {
    return (
      <div className="h-full overflow-hidden">
        <ChatScrollerPlaceholder count={30} />
      </div>
    );
  }

  if (!compatible && messages.length === 0) {
    return (
      <div className="h-full w-full overflow-hidden">
        <EmptyPlaceholder>
          <p>
            There may be content in this channel, but it is inaccessible because
            the host is using an older, incompatible version of the app.
          </p>
          <p>Please try again later.</p>
        </EmptyPlaceholder>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <ChatUnreadAlerts nest={nest} root={root} />
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
          fetchState={fetchState}
          whom={whom}
          topLoadEndMarker={prefixedElement}
          scrollTo={scrollTo}
          scrollerRef={scrollerRef}
          onAtTop={onAtTop}
          onAtBottom={onAtBottom}
          scrollElementRef={scrollElementRef}
          isScrolling={isScrolling}
          hasLoadedOldest={!hasNextPage}
          hasLoadedNewest={!hasPreviousPage}
        />
      </div>
      {scrollTo && (hasNextPage || latestIsMoreThan30NewerThanScrollTo) ? (
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
