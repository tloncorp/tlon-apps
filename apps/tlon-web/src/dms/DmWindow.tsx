import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';

import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import ChatScrollerPlaceholder from '@/chat/ChatScroller/ChatScrollerPlaceholder';
import DMUnreadAlerts from '@/chat/DMUnreadAlerts';
import { useChatInfo, useChatStore } from '@/chat/useChatStore';
import ArrowS16Icon from '@/components/icons/ArrowS16Icon';
import { useIsScrolling } from '@/logic/scroll';
import { getPatdaParts, log } from '@/logic/utils';
import { useInfiniteDMs, useMarkDmReadMutation } from '@/state/chat';
import { WritTuple } from '@/types/dms';

interface DmWindowProps {
  whom: string;
  root: string;
  prefixedElement?: ReactElement;
}

function checkWritMatch(writ: WritTuple, scrollTo: string) {
  const writServerTime = writ[0].toString();
  const { timeDec } = getPatdaParts(writ[1].seal.id);
  return scrollTo === writServerTime || scrollTo === timeDec;
}

export default function DmWindow({
  whom,
  root,
  prefixedElement,
}: DmWindowProps) {
  const [searchParams, setSearchParams] = useSearchParams();
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
  const clearOnNavRef = useRef({ readTimeout, whom, markDmRead });

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
  } = useInfiniteDMs(whom, scrollToId);
  const navigate = useNavigate();

  const latestMessageIndex = writs.length - 1;
  const scrollToIndex = useMemo(
    () =>
      scrollToId
        ? writs.findIndex((writ) => checkWritMatch(writ, scrollToId))
        : -1,
    [scrollToId, writs]
  );
  const scrollToInMessages = useMemo(
    () => scrollToIndex !== -1,
    [scrollToIndex]
  );
  const latestIsMoreThan30NewerThanScrollTo = useMemo(
    () =>
      scrollToInMessages &&
      scrollToIndex !== latestMessageIndex &&
      latestMessageIndex - scrollToIndex > 30,
    [scrollToInMessages, scrollToIndex, latestMessageIndex]
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
      // wait until next tick to avoid the race condition where refetch
      // happens before navigation completes and clears scrollToId
      // TODO: is there a better way to handle this?
      setTimeout(() => {
        remove();
        refetch();
      }, 0);
    } else {
      scrollerRef.current?.scrollToIndex({ index: 'LAST', align: 'end' });
    }
  }, [
    setSearchParams,
    remove,
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
  useEffect(() => {
    clearOnNavRef.current = { readTimeout, whom, markDmRead };
  }, [readTimeout, whom, markDmRead]);

  useEffect(
    () => () => {
      const curr = clearOnNavRef.current;
      if (curr.readTimeout !== undefined && curr.readTimeout !== 0) {
        useChatStore.getState().read(curr.whom);
        curr.markDmRead({ whom: curr.whom });
      }
    },
    []
  );

  useEffect(() => {
    const doRefetch = async () => {
      remove();
      await refetch();
    };

    // If we have a scrollTo, we have a next page, and the scrollTo message is
    // not in our current set of messages, that means we're scrolling to a
    // message that's not yet cached. So, we need to refetch (which would fetch
    // messages around the scrollTo time), then scroll to the message.
    if (scrollToId && hasNextPage && !scrollToInMessages) {
      doRefetch();
    }
  }, [scrollToId, hasNextPage, refetch, scrollToInMessages, remove]);

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
