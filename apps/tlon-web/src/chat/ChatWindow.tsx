import { PostTuple } from '@tloncorp/shared/dist/urbit/channel';
import bigInt from 'big-integer';
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';

import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import ChatUnreadAlerts from '@/chat/ChatUnreadAlerts';
import EmptyPlaceholder from '@/components/EmptyPlaceholder';
import ArrowS16Icon from '@/components/icons/ArrowS16Icon';
import { useChannelCompatibility } from '@/logic/channel';
import { log } from '@/logic/utils';
import { useInfinitePosts, useMarkReadMutation } from '@/state/channel/channel';

import ChatScrollerPlaceholder from './ChatScroller/ChatScrollerPlaceholder';
import { useChatInfo, useChatStore } from './useChatStore';

const WINDOW_SIZE = 30;

interface ChatWindowProps {
  whom: string;
  root: string;
  prefixedElement?: ReactElement;
  scrollElementRef: React.RefObject<HTMLDivElement>;
  isScrolling: boolean;
}

export default function ChatWindow({
  whom,
  root,
  prefixedElement,
  scrollElementRef,
  isScrolling,
}: ChatWindowProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { idTime } = useParams();
  const scrollToId = useMemo(
    () => searchParams.get('msg') || searchParams.get('edit') || idTime,
    [searchParams, idTime]
  );
  const nest = `chat/${whom}`;
  const {
    posts: messages,
    hasNextPage,
    hasPreviousPage,
    fetchPreviousPage,
    refetch,
    remove,
    fetchNextPage,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isFetchingPreviousPage,
  } = useInfinitePosts(nest, scrollToId);
  const { mutate: markRead } = useMarkReadMutation();
  const totalMessagesCached = messages ? messages.length : 0;
  const [scrollerMessages, setScrollerMessages] = useState<PostTuple[]>([]);
  const [shouldInvert, setShouldInvert] = useState(true);
  const [scrollerMessagesSliceStart, setScrollerMessagesSliceStart] =
    useState<number>();
  const [scrollerMessagesSliceEnd, setScrollerMessagesSliceEnd] =
    useState<number>();
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [fakeLoadingOlder, setFakeLoadingOlder] = useState(false);
  const [fakeLoadingNewer, setFakeLoadingNewer] = useState(false);
  const totalPagesCached = useMemo(
    () => Math.ceil(totalMessagesCached / WINDOW_SIZE),
    [totalMessagesCached]
  );
  const [initialLoad, setInitialLoad] = useState(true);
  const seenScrollToIdRef = useRef(false);
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const readTimeout = useChatInfo(whom).unread?.readTimeout;
  const clearOnNavRef = useRef({ readTimeout, nest, whom, markRead });
  const { compatible } = useChannelCompatibility(nest);
  const navigate = useNavigate();
  const latestMessageIndex = messages.length - 1;
  const scrollToIndex = useMemo(
    () =>
      scrollToId
        ? messages.findIndex((m) => m[0].toString() === scrollToId)
        : latestMessageIndex,
    [scrollToId, messages, latestMessageIndex]
  );
  const msgIdTimeInMessages = useMemo(
    () =>
      scrollToId
        ? messages.findIndex((m) => m[0].toString() === scrollToId) !== -1
        : false,
    [scrollToId, messages]
  );
  const msgIdTimeInScrollerMessages = useMemo(
    () =>
      scrollToId
        ? scrollerMessages.findIndex((m) => m[0].toString() === scrollToId) !==
          -1
        : false,
    [scrollToId, scrollerMessages]
  );
  const latestIsMoreThan30NewerThanScrollTo = useMemo(
    () =>
      scrollToIndex !== latestMessageIndex &&
      latestMessageIndex - scrollToIndex > 30,
    [scrollToIndex, latestMessageIndex]
  );

  const goToLatest = useCallback(async () => {
    if (idTime) {
      navigate(root);
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
    root,
  ]);

  const lastScrollerMessagesSliceStart = useRef<number | undefined>(undefined);
  const lastScrollerMessagesSliceEnd = useRef<number | undefined>(undefined);
  const lastWhom = useRef<string | undefined>(undefined);

  useEffect(() => {
    // scrollerMessages only updates when slice start and end change
    // or on initial load

    if (initialLoad && totalMessagesCached > 0 && !isLoading && !scrollToId) {
      // if we're in the initial load, and we have messages, and we're not
      // fetching, and we don't have a scrollToId, then we should set the
      // scrollerMessages to the default slice start/end

      setScrollerMessagesSliceStart(totalMessagesCached - WINDOW_SIZE);
      setScrollerMessagesSliceEnd(totalMessagesCached);
      setCurrentPageIndex(1);

      setScrollerMessages(
        messages.slice(scrollerMessagesSliceStart, scrollerMessagesSliceEnd)
      );

      setInitialLoad(false);
    }

    if (
      !initialLoad &&
      !fakeLoadingNewer &&
      !fakeLoadingOlder &&
      totalMessagesCached > 0 &&
      scrollerMessagesSliceStart !== undefined &&
      scrollerMessagesSliceStart >= 0 &&
      scrollerMessagesSliceEnd !== undefined &&
      scrollerMessagesSliceEnd <= totalMessagesCached &&
      lastWhom.current === whom &&
      (lastScrollerMessagesSliceStart.current !== scrollerMessagesSliceStart ||
        lastScrollerMessagesSliceEnd.current !== scrollerMessagesSliceEnd)
    ) {
      // if we're not in the initial load, and we're not faking loading newer
      // or older messages, and we have a slice start and end, and the slice
      // start and end are within the bounds of the total messages cached, and
      // the whom hasn't changed, and the slice start and end have changed, then
      // we should update the scrollerMessages

      setScrollerMessages(
        messages.slice(scrollerMessagesSliceStart, scrollerMessagesSliceEnd)
      );
      lastScrollerMessagesSliceStart.current = scrollerMessagesSliceStart;
      lastScrollerMessagesSliceEnd.current = scrollerMessagesSliceEnd;
    }
  }, [
    messages,
    scrollerMessagesSliceStart,
    scrollerMessagesSliceEnd,
    fakeLoadingNewer,
    fakeLoadingOlder,
    totalMessagesCached,
    whom,
    initialLoad,
    isLoading,
    scrollToId,
  ]);

  useEffect(() => {
    useChatStore.getState().setCurrent(whom);
    return () => {
      useChatStore.getState().setCurrent('');
    };
  }, [whom]);

  useEffect(() => {
    // channel switch

    if (whom !== lastWhom.current && !scrollToId) {
      lastWhom.current = whom;
      setInitialLoad(true);
    }
  }, [whom, totalMessagesCached, scrollToId]);

  useEffect(() => {
    // if we have a scrollToId and we're in the initial load, and the scrollToId
    // is not in the current set of scrollerMessages, then we need to update the
    // slice start and end to include the scrollToId

    if (initialLoad && scrollToId && !msgIdTimeInScrollerMessages) {
      const sliceStart = scrollToIndex - WINDOW_SIZE / 2;
      const sliceEnd = scrollToIndex + WINDOW_SIZE / 2;
      const pageIndex =
        1 +
        totalPagesCached -
        Math.ceil((scrollToIndex / totalMessagesCached) * totalPagesCached);

      if (sliceStart > 0) {
        setScrollerMessagesSliceStart(sliceStart);
        setScrollerMessagesSliceEnd(sliceEnd);
        setCurrentPageIndex(pageIndex);
        lastWhom.current = whom;
        seenScrollToIdRef.current = true;
        setInitialLoad(false);
        setShouldInvert(false);
      }
    }
  }, [
    initialLoad,
    whom,
    messages,
    currentPageIndex,
    totalMessagesCached,
    scrollToId,
    scrollToIndex,
    msgIdTimeInScrollerMessages,
    totalPagesCached,
  ]);

  const onAtBottom = useCallback(() => {
    setShouldInvert(false);

    if (
      currentPageIndex === 1 &&
      scrollerMessagesSliceEnd !== totalMessagesCached &&
      !isFetching &&
      !fakeLoadingNewer &&
      !fakeLoadingOlder
    ) {
      setFakeLoadingNewer(true);
      setScrollerMessagesSliceEnd(totalMessagesCached);
    }

    if (
      currentPageIndex !== 1 &&
      !isFetching &&
      scrollerMessagesSliceEnd &&
      !fakeLoadingNewer &&
      !fakeLoadingOlder
    ) {
      // if we're not at the bottom of the first page, and we're not fetching,
      // and we're not faking loading, and we have a slice end, then
      // we should fake load newer messages

      setFakeLoadingNewer(true);
      const maybeSliceEnd = scrollerMessagesSliceEnd + WINDOW_SIZE;
      const sliceEnd =
        maybeSliceEnd > totalMessagesCached
          ? totalMessagesCached
          : maybeSliceEnd;

      setScrollerMessagesSliceEnd(sliceEnd);

      setCurrentPageIndex((prev) => prev - 1);
    }

    const { bottom, delayedRead } = useChatStore.getState();
    bottom(true);
    delayedRead(whom, () => markRead({ nest }));
    if (currentPageIndex === 1 && hasPreviousPage && !isFetching) {
      log('fetching previous page');
      fetchPreviousPage();
    }

    setTimeout(() => {
      setFakeLoadingNewer(false);
    }, 100);
  }, [
    nest,
    whom,
    markRead,
    fetchPreviousPage,
    hasPreviousPage,
    isFetching,
    currentPageIndex,
    fakeLoadingNewer,
    fakeLoadingOlder,
    scrollerMessagesSliceEnd,
    totalMessagesCached,
  ]);

  const onAtTop = useCallback(() => {
    setShouldInvert(true);

    if (
      currentPageIndex !== totalPagesCached &&
      !isFetching &&
      !fakeLoadingOlder &&
      !fakeLoadingNewer &&
      scrollerMessagesSliceEnd
    ) {
      // if we're not at the top of the first page, and we're not fetching,
      // and we're not faking loading, and we have a slice end, then we should
      // fake load older messages

      setFakeLoadingOlder(true);
      const newPageIndex = currentPageIndex + 1;
      const sliceStart =
        totalMessagesCached -
        (newPageIndex / totalPagesCached) * totalMessagesCached;

      setScrollerMessagesSliceStart(sliceStart);
      setCurrentPageIndex((prev) => prev + 1);
    }

    if (currentPageIndex === totalPagesCached && hasNextPage && !isFetching) {
      log('fetching next page');
      fetchNextPage();
    }

    setTimeout(() => {
      setFakeLoadingOlder(false);
    }, 300);
  }, [
    fetchNextPage,
    hasNextPage,
    isFetching,
    currentPageIndex,
    totalPagesCached,
    scrollerMessagesSliceEnd,
    fakeLoadingOlder,
    fakeLoadingNewer,
    totalMessagesCached,
  ]);

  useEffect(() => {
    // if we have loaded the newest messages then we're at the bottom
    // then we should be inverted
    if (
      currentPageIndex === 1 &&
      scrollerMessagesSliceEnd === totalMessagesCached &&
      !hasPreviousPage
    ) {
      setShouldInvert(true);
    }
  }, [
    currentPageIndex,
    scrollerMessagesSliceEnd,
    totalMessagesCached,
    hasPreviousPage,
  ]);

  // read the messages once navigated away
  useEffect(() => {
    clearOnNavRef.current = { readTimeout, nest, whom, markRead };
  }, [readTimeout, nest, whom, markRead]);

  useEffect(
    () => () => {
      const curr = clearOnNavRef.current;
      if (curr.readTimeout !== undefined && curr.readTimeout !== 0) {
        useChatStore.getState().read(curr.whom);
        curr.markRead({ nest: curr.nest });
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
    if (scrollToId && hasNextPage && !msgIdTimeInMessages) {
      doRefetch();
    }
  }, [scrollToId, hasNextPage, remove, refetch, msgIdTimeInMessages]);

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
          messages={scrollerMessages}
          shouldInvert={shouldInvert}
          isLoadingOlder={fakeLoadingOlder ?? isFetchingNextPage}
          isLoadingNewer={fakeLoadingNewer ?? isFetchingPreviousPage}
          whom={whom}
          topLoadEndMarker={prefixedElement}
          scrollTo={scrollToId ? bigInt(scrollToId) : undefined}
          scrollerRef={scrollerRef}
          onAtTop={onAtTop}
          onAtBottom={onAtBottom}
          scrollElementRef={scrollElementRef}
          isScrolling={isScrolling}
          hasLoadedOldest={
            currentPageIndex === totalPagesCached && !hasNextPage
          }
          hasLoadedNewest={
            currentPageIndex === 1 &&
            scrollerMessagesSliceEnd === totalMessagesCached &&
            !hasPreviousPage
          }
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
