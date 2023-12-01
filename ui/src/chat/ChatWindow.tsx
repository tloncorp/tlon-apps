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
    isFetching,
    isFetchingNextPage,
    isFetchingPreviousPage,
  } = useInfinitePosts(nest, scrollTo?.toString(), shouldGetLatest);
  const { mutate: markRead } = useMarkReadMutation();
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const readTimeout = useChatInfo(whom).unread?.readTimeout;
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
    if (hasPreviousPage) {
      await refetch();
      setShouldGetLatest(false);
    } else {
      scrollerRef.current?.scrollToIndex({ index: 'LAST', align: 'end' });
    }
  }, [setSearchParams, refetch, hasPreviousPage, scrollerRef]);

  useEffect(() => {
    useChatStore.getState().setCurrent(whom);

    return () => {
      useChatStore.getState().setCurrent('');
    };
  }, [whom]);

  const onAtBottom = useCallback(() => {
    const { bottom, delayedRead } = useChatStore.getState();
    bottom(true);
    delayedRead(whom, () => markRead({ nest }));
    if (hasPreviousPage && !isFetching) {
      log('fetching previous page');
      fetchPreviousPage();
    }
  }, [nest, whom, markRead, fetchPreviousPage, hasPreviousPage, isFetching]);

  const onAtTop = useCallback(() => {
    if (hasNextPage && !isFetching) {
      log('fetching next page');
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetching]);

  useEffect(
    () => () => {
      if (readTimeout !== undefined && readTimeout !== 0) {
        useChatStore.getState().read(whom);
        markRead({ nest });
      }
    },
    [readTimeout, nest, whom, markRead]
  );

  useEffect(() => {
    if (scrollTo && hasPreviousPage) {
      setShouldGetLatest(true);
    }
  }, [scrollTo, hasPreviousPage]);

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
          key={nest}
          messages={messages}
          isLoadingOlder={isFetchingNextPage}
          isLoadingNewer={isFetchingPreviousPage}
          whom={nest}
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
      {scrollTo && (hasPreviousPage || latestIsMoreThan30NewerThanScrollTo) ? (
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
