import { sourceToString } from '@tloncorp/shared/urbit/activity';
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
import EmptyPlaceholder from '@/components/EmptyPlaceholder';
import ArrowS16Icon from '@/components/icons/ArrowS16Icon';
import { useChannelCompatibility, useMarkChannelRead } from '@/logic/channel';
import { log } from '@/logic/utils';
import queryClient from '@/queryClient';
import { unreadsKey } from '@/state/activity';
import { useInfinitePosts } from '@/state/channel/channel';
import { useRouteGroup } from '@/state/groups';

import ChatScrollerPlaceholder from './ChatScroller/ChatScrollerPlaceholder';
import UnreadAlerts from './UnreadAlerts';
import { useChatStore } from './useChatStore';

interface ChatWindowProps {
  whom: string;
  root: string;
  prefixedElement?: ReactElement;
  scrollElementRef: React.RefObject<HTMLDivElement>;
  isScrolling: boolean;
}

const ChatWindow = React.memo(function ChatWindowRaw({
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
  const flag = useRouteGroup();
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
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const fetchingNewest =
    isFetching && (!isFetchingNextPage || !isFetchingPreviousPage);
  const [showUnreadBanner, setShowUnreadBanner] = useState(false);
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
    useChatStore.getState().setCurrent({ whom, group: flag });

    return () => {
      useChatStore.getState().setCurrent(null);
    };
  }, [whom, flag]);

  const onAtBottom = useCallback(
    (atBottom: boolean) => {
      const { bottom } = useChatStore.getState();
      bottom(atBottom);
      if (atBottom && hasPreviousPage && !isFetching) {
        log('fetching previous page');
        fetchPreviousPage();
      }
    },
    [fetchPreviousPage, hasPreviousPage, isFetching]
  );

  const onAtTop = useCallback(
    (atTop: boolean) => {
      if (atTop && hasNextPage && !isFetching) {
        log('fetching next page');
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetching]
  );

  /**
   * we want to show unread banner after messages have had a chance to
   * render, so that we don't flash it right before removing it because
   * we saw the unread marker
   */
  useEffect(() => {
    let timeout = 0;
    setShowUnreadBanner(false);
    if (!fetchingNewest) {
      timeout = setTimeout(() => {
        setShowUnreadBanner(true);
      }, 250) as unknown as number;
    }

    return () => {
      clearTimeout(timeout);
    };
  }, [fetchingNewest]);

  useEffect(() => {
    const src = sourceToString({ channel: { nest, group: flag } });
    const queryKey = unreadsKey('threads', src);
    queryClient.invalidateQueries(queryKey, { refetchType: 'all' });
  }, [nest, flag]);

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
      {showUnreadBanner && !fetchingNewest ? (
        <UnreadAlerts whom={whom} root={root} />
      ) : null}
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
          isLoadingOlder={isFetchingNextPage}
          isLoadingNewer={isFetchingPreviousPage}
          whom={whom}
          topLoadEndMarker={prefixedElement}
          scrollTo={scrollToId ? bigInt(scrollToId) : undefined}
          scrollerRef={scrollerRef}
          onAtTopChange={onAtTop}
          onAtBottomChange={onAtBottom}
          scrollElementRef={scrollElementRef}
          isScrolling={isScrolling}
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
});

export default ChatWindow;
