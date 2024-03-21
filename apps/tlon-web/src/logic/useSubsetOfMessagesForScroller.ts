import { PostTuple } from '@tloncorp/shared/dist/urbit/channel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useChatStore } from '@/chat/useChatStore';
import { log } from '@/logic/utils';

export default function useSubsetOfMessagesForScroller(
  messages: PostTuple[],
  isLoading: boolean,
  isFetching: boolean,
  hasPreviousPage: boolean | undefined,
  isFetchingPreviousPage: boolean,
  hasNextPage: boolean | undefined,
  fetchPreviousPage: () => void,
  fetchNextPage: () => void,
  isFetchingNextPage: boolean,
  whom: string,
  nest: string,
  scrollToId: string | undefined,
  scrollToIndex: number,
  msgIdTimeInMessages: boolean,
  markRead: (props: { nest: string }) => void
) {
  const WINDOW_SIZE = 30;
  const totalMessagesCached = messages ? messages.length : 0;
  const [scrollerMessages, setScrollerMessages] = useState<PostTuple[]>([]);
  const [shouldInvert, setShouldInvert] = useState(true);
  const [scrollerMessagesSliceStart, setScrollerMessagesSliceStart] =
    useState<number>();
  const [scrollerMessagesSliceEnd, setScrollerMessagesSliceEnd] =
    useState<number>();
  const [hasSeenScrollToId, setHasSeenScrollToId] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [fakeLoadingOlder, setFakeLoadingOlder] = useState(false);
  const [fakeLoadingNewer, setFakeLoadingNewer] = useState(false);
  const totalPagesCached = useMemo(
    () => Math.ceil(totalMessagesCached / WINDOW_SIZE),
    [totalMessagesCached]
  );
  const [initialLoad, setInitialLoad] = useState(true);
  const msgIdTimeInScrollerMessages = useMemo(
    () =>
      scrollToId
        ? scrollerMessages.findIndex((m) => m[0].toString() === scrollToId) !==
          -1
        : false,
    [scrollToId, scrollerMessages]
  );
  const hasLoadedNewest = useMemo(
    () =>
      currentPageIndex === 1 &&
      scrollerMessagesSliceEnd === totalMessagesCached &&
      !hasPreviousPage,
    [
      currentPageIndex,
      scrollerMessagesSliceEnd,
      totalMessagesCached,
      hasPreviousPage,
    ]
  );
  const hasLoadedOldest = useMemo(
    () => currentPageIndex === totalPagesCached && !hasNextPage,
    [currentPageIndex, totalPagesCached, hasNextPage]
  );
  const isLoadingOlder = useMemo(
    () => fakeLoadingOlder ?? isFetchingNextPage,
    [fakeLoadingOlder, isFetchingNextPage]
  );
  const isLoadingNewer = useMemo(
    () => fakeLoadingNewer ?? isFetchingPreviousPage,
    [fakeLoadingNewer, isFetchingPreviousPage]
  );
  const isFetchingOrFakeLoading = useMemo(
    () => isFetching || fakeLoadingOlder || fakeLoadingNewer,
    [isFetching, fakeLoadingOlder, fakeLoadingNewer]
  );
  const lastScrollerMessagesSliceStart = useRef<number | undefined>(undefined);
  const lastScrollerMessagesSliceEnd = useRef<number | undefined>(undefined);
  const lastWhom = useRef<string | undefined>(undefined);

  useEffect(() => {
    // if we have loaded the newest messages then we're at the bottom
    // then we should be inverted
    if (hasLoadedNewest) {
      setShouldInvert(true);
    }
  }, [hasLoadedNewest]);

  useEffect(() => {
    // channel switch

    if (whom !== lastWhom.current && !scrollToId) {
      lastWhom.current = whom;
      setInitialLoad(true);
    }
  }, [whom, totalMessagesCached, scrollToId]);

  useEffect(() => {
    // if we have a scrollToId, then we need to set the initial load to true
    // so that we can update the slice start and end to include the scrollToId

    if (scrollToId && hasSeenScrollToId !== scrollToId) {
      setInitialLoad(true);
    }
  }, [scrollToId, hasSeenScrollToId]);

  useEffect(() => {
    // if we have a scrollToId and we're in the initial load, and the scrollToId
    // is not in the current set of scrollerMessages, then we need to update the
    // slice start and end to include the scrollToId

    if (
      initialLoad &&
      scrollToId &&
      msgIdTimeInMessages &&
      scrollToId !== hasSeenScrollToId &&
      !msgIdTimeInScrollerMessages
    ) {
      const sliceStart = scrollToIndex - WINDOW_SIZE / 2;
      const sliceEnd = scrollToIndex + WINDOW_SIZE / 2;
      const pageIndex =
        1 +
        totalPagesCached -
        Math.ceil((scrollToIndex / totalMessagesCached) * totalPagesCached);

      if (sliceStart > 0) {
        setScrollerMessagesSliceStart(sliceStart);
        if (sliceEnd > totalMessagesCached) {
          // if the slice end is greater than the total messages cached, then
          // we're at the bottom of the messages, so we should set the slice end
          // to the total messages cached
          setScrollerMessagesSliceEnd(totalMessagesCached);
        } else {
          setScrollerMessagesSliceEnd(sliceEnd);
        }
        setCurrentPageIndex(pageIndex);
        lastWhom.current = whom;
        setInitialLoad(false);
        setShouldInvert(false);
        setHasSeenScrollToId(scrollToId);
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
    msgIdTimeInMessages,
    totalPagesCached,
    hasSeenScrollToId,
  ]);

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

  const onAtBottom = useCallback(() => {
    setShouldInvert(false);

    if (
      currentPageIndex === 1 &&
      scrollerMessagesSliceEnd !== totalMessagesCached &&
      !isFetchingOrFakeLoading
    ) {
      setFakeLoadingNewer(true);
      setScrollerMessagesSliceEnd(totalMessagesCached);
    }

    if (
      currentPageIndex !== 1 &&
      scrollerMessagesSliceEnd &&
      !isFetchingOrFakeLoading
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
    scrollerMessagesSliceEnd,
    totalMessagesCached,
    isFetchingOrFakeLoading,
  ]);

  const onAtTop = useCallback(() => {
    setShouldInvert(true);

    if (
      currentPageIndex !== totalPagesCached &&
      !isFetchingOrFakeLoading &&
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
    totalMessagesCached,
    isFetchingOrFakeLoading,
  ]);

  return {
    scrollerMessages,
    onAtBottom,
    onAtTop,
    shouldInvert,
    hasLoadedNewest,
    hasLoadedOldest,
    isLoadingOlder,
    isLoadingNewer,
  };
}
