import {
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
import DMUnreadAlerts from '@/chat/DMUnreadAlerts';
import { useInfiniteDMs, useMarkDmReadMutation } from '@/state/chat';
import ArrowS16Icon from '@/components/icons/ArrowS16Icon';
import { log } from '@/logic/utils';
import { useChatInfo, useChatStore } from '@/chat/useChatStore';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import { useIsScrolling } from '@/logic/scroll';
import ChatScrollerPlaceholder from '@/chat/ChatScroller/ChatScrollerPlaceholder';

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
  const [shouldGetLatest, setShouldGetLatest] = useState(false);
  const scrollTo = getScrollTo(searchParams.get('msg'));
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const readTimeout = useChatInfo(whom).unread?.readTimeout;
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);
  const { mutate: markDmRead } = useMarkDmReadMutation();

  const {
    writs,
    hasNextPage,
    hasPreviousPage,
    refetch,
    isLoading,
    fetchNextPage,
    fetchPreviousPage,
    isFetching,
    isFetchingNextPage,
    isFetchingPreviousPage,
  } = useInfiniteDMs(whom, scrollTo?.toString(), shouldGetLatest);

  const latestMessageIndex = writs.length - 1;
  const scrollToIndex = useMemo(
    () =>
      scrollTo ? writs.findIndex((m) => m[0].eq(scrollTo)) : latestMessageIndex,
    [scrollTo, writs, latestMessageIndex]
  );
  const latestIsMoreThan30NewerThanScrollTo = useMemo(
    () =>
      scrollToIndex !== latestMessageIndex &&
      latestMessageIndex - scrollToIndex > 30,
    [scrollToIndex, latestMessageIndex]
  );

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
    if (hasPreviousPage && !isFetching) {
      log('fetching previous page');
      fetchPreviousPage();
    }
  }, [fetchPreviousPage, hasPreviousPage, isFetching]);

  const onAtTop = useCallback(() => {
    if (hasNextPage && !isFetching) {
      log('fetching next page');
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetching]);

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

  // read the messages once navigated away
  useEffect(
    () => () => {
      if (readTimeout !== undefined && readTimeout !== 0) {
        useChatStore.getState().read(whom);
        markDmRead({ whom });
      }
    },
    [readTimeout, whom, markDmRead]
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
