import bigInt from 'big-integer';
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';

import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import ChatUnreadAlerts from '@/chat/ChatUnreadAlerts';
import EmptyPlaceholder from '@/components/EmptyPlaceholder';
import ArrowS16Icon from '@/components/icons/ArrowS16Icon';
import { useChannelCompatibility } from '@/logic/channel';
import useSubsetOfMessagesForScroller from '@/logic/useSubsetOfMessagesForScroller';
import { useInfinitePosts, useMarkReadMutation } from '@/state/channel/channel';

import ChatScrollerPlaceholder from './ChatScroller/ChatScrollerPlaceholder';
import { useChatInfo, useChatStore } from './useChatStore';

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
  const {
    scrollerMessages,
    onAtBottom,
    onAtTop,
    shouldInvert,
    hasLoadedNewest,
    hasLoadedOldest,
    isLoadingNewer,
    isLoadingOlder,
  } = useSubsetOfMessagesForScroller(
    messages,
    isLoading,
    isFetching,
    hasPreviousPage,
    isFetchingPreviousPage,
    hasNextPage,
    fetchPreviousPage,
    fetchNextPage,
    isFetchingNextPage,
    whom,
    nest,
    scrollToId,
    scrollToIndex,
    msgIdTimeInMessages,
    markRead
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

  useEffect(() => {
    useChatStore.getState().setCurrent(whom);
    return () => {
      useChatStore.getState().setCurrent('');
    };
  }, [whom]);

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
          isLoadingOlder={isLoadingOlder}
          isLoadingNewer={isLoadingNewer}
          whom={whom}
          topLoadEndMarker={prefixedElement}
          scrollTo={scrollToId ? bigInt(scrollToId) : undefined}
          scrollerRef={scrollerRef}
          onAtTop={onAtTop}
          onAtBottom={onAtBottom}
          scrollElementRef={scrollElementRef}
          isScrolling={isScrolling}
          hasLoadedOldest={hasLoadedOldest}
          hasLoadedNewest={hasLoadedNewest}
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
