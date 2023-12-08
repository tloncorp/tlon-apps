import {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import bigInt from 'big-integer';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';
import DMUnreadAlerts from '@/chat/DMUnreadAlerts';
import { useInfiniteDMs, useMarkDmReadMutation } from '@/state/chat';
import ArrowS16Icon from '@/components/icons/ArrowS16Icon';
import { log } from '@/logic/utils';
import { useChatInfo, useChatStore } from '@/chat/useChatStore';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import { useIsScrolling } from '@/logic/scroll';
import ChatScrollerPlaceholder from '@/chat/ChatScroller/ChatScrollerPlaceholder';
import { udToDec } from '@urbit/api';

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
  const { idTime } = useParams();
  const scrollToId = useMemo(
    () => searchParams.get('msg') || (idTime ? udToDec(idTime) : undefined),
    [searchParams, idTime]
  );
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
    remove,
    isLoading,
    fetchNextPage,
    fetchPreviousPage,
    isFetching,
    isFetchingNextPage,
    isFetchingPreviousPage,
  } = useInfiniteDMs(whom, scrollToId, shouldGetLatest);
  const navigate = useNavigate();

  const latestMessageIndex = writs.length - 1;
  const msgIdTimeIndex = useMemo(
    () =>
      scrollToId
        ? writs.findIndex((m) => m[0].toString() === scrollToId)
        : latestMessageIndex,
    [scrollToId, writs, latestMessageIndex]
  );
  const msgIdTimeInMessages = useMemo(
    () =>
      scrollToId
        ? writs.findIndex((m) => m[0].toString() === scrollToId) !== -1
        : false,
    [scrollToId, writs]
  );
  const latestIsMoreThan30NewerThanScrollTo = useMemo(
    () =>
      msgIdTimeIndex !== latestMessageIndex &&
      latestMessageIndex - msgIdTimeIndex > 30,
    [msgIdTimeIndex, latestMessageIndex]
  );

  const onAtBottom = useCallback(() => {
    const { bottom, delayedRead } = useChatStore.getState();
    bottom(true);
    delayedRead(whom, () => markDmRead({ whom }));
    if (hasPreviousPage && !isFetching) {
      log('fetching previous page');
      fetchPreviousPage();
    }
  }, [fetchPreviousPage, hasPreviousPage, isFetching, whom, markDmRead]);

  const onAtTop = useCallback(() => {
    if (hasNextPage && !isFetching) {
      log('fetching next page');
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetching]);

  const goToLatest = useCallback(async () => {
    if (idTime) {
      navigate(`/dm/${whom}`);
    } else {
      setSearchParams({});
    }
    if (hasPreviousPage) {
      await refetch();
      setShouldGetLatest(false);
    } else {
      scrollerRef.current?.scrollToIndex({ index: 'LAST', align: 'end' });
    }
  }, [
    setSearchParams,
    refetch,
    hasPreviousPage,
    scrollerRef,
    idTime,
    navigate,
    whom,
  ]);

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
    // If we have a scrollTo and we have newer data that's not yet loaded, we
    // need to make sure we get the latest data the next time we fetch (i.e.,
    // when the user cliks the "Go to Latest" button).
    if (scrollToId && hasPreviousPage) {
      setShouldGetLatest(true);
    }
  }, [scrollToId, hasPreviousPage]);

  useEffect(() => {
    const doRefetch = async () => {
      remove();
      await refetch();
    };

    // If we have a scrollTo, we have a next page, and the scrollTo message is
    // not in our current set of messages, that means we're scrolling to a
    // message that's not yet cached. So, we need to refetch (which would fetch
    // messages around the scrollTo time), then scroll to the message.
    // We also need to make sure that shouldGetLatest is false, so that we don't
    // get into a loop of fetching the latest data.
    if (scrollToId && hasNextPage && !msgIdTimeInMessages && !shouldGetLatest) {
      doRefetch();
    }
  }, [
    scrollToId,
    hasNextPage,
    refetch,
    msgIdTimeInMessages,
    shouldGetLatest,
    remove,
  ]);

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
          isLoadingOlder={isFetchingNextPage}
          isLoadingNewer={isFetchingPreviousPage}
          whom={whom}
          scrollTo={scrollToId ? bigInt(scrollToId) : undefined}
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
      {scrollToId &&
      (hasPreviousPage || latestIsMoreThan30NewerThanScrollTo) ? (
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
