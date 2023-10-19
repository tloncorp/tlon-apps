import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import bigInt from 'big-integer';
import { useSearchParams } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';
import DMUnreadAlerts from '@/chat/DMUnreadAlerts';
import {
  useChatLoading,
  useChatState,
  useMessagesForChat,
  useWritWindow,
} from '@/state/chat';
import ArrowS16Icon from '@/components/icons/ArrowS16Icon';
import { useChatInfo, useChatStore } from '@/chat/useChatStore';
import ChatScrollerPlaceholder from '@/chat/ChatScroller/ChatScrollerPlaceholder';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import { useIsScrolling } from '@/logic/scroll';
import { STANDARD_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';

interface DmWindowProps {
  whom: string;
  root: string;
  prefixedElement?: ReactNode;
}

function getScrollTo(msg: string | null) {
  return msg ? bigInt(msg) : undefined;
}

export default function DmWindow({
  whom,
  root,
  prefixedElement,
}: DmWindowProps) {
  const [fetchState, setFetchState] = useState<'initial' | 'bottom' | 'top'>(
    'initial'
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollTo = getScrollTo(searchParams.get('msg'));
  const loading = useChatLoading(whom);
  const messages = useMessagesForChat(whom, scrollTo?.toString());
  const window = useWritWindow(whom);
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const readTimeout = useChatInfo(whom).unread?.readTimeout;
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);
  const pageSize = STANDARD_MESSAGE_FETCH_PAGE_SIZE.toString();

  const onAtTop = useCallback(async () => {
    const store = useChatStore.getState();
    const oldest = messages.minKey();
    const seenOldest = oldest && window && window.loadedOldest;
    if (seenOldest) {
      return;
    }
    setFetchState('top');
    await useChatState
      .getState()
      .fetchMessages(whom, pageSize, 'older', scrollTo?.toString());
    setFetchState('initial');
    store.bottom(false);
  }, [whom, scrollTo, pageSize, messages, window]);

  const onAtBottom = useCallback(async () => {
    const store = useChatStore.getState();
    const newest = messages.maxKey();
    const seenNewest = newest && window && window.loadedNewest;
    if (seenNewest) {
      return;
    }
    setFetchState('bottom');
    await useChatState
      .getState()
      .fetchMessages(whom, pageSize, 'newer', scrollTo?.toString());
    setFetchState('initial');
    store.bottom(true);
    store.delayedRead(whom, () => useChatState.getState().markDmRead(whom));
  }, [whom, scrollTo, pageSize, messages, window]);

  const goToLatest = useCallback(() => {
    setSearchParams({});
    scrollerRef.current?.scrollToIndex({ index: 'LAST', align: 'end' });
  }, [setSearchParams]);

  useEffect(() => {
    if (scrollTo && !messages.has(scrollTo)) {
      useChatState
        .getState()
        .fetchMessagesAround(whom, '25', scrollTo.toString());
    }
  }, [scrollTo, messages, whom]);

  useEffect(() => {
    useChatStore.getState().setCurrent(whom);
  }, [whom]);

  useEffect(
    () => () => {
      if (readTimeout !== undefined && readTimeout !== 0) {
        useChatStore.getState().read(whom);
      }
    },
    [readTimeout, whom]
  );

  if (loading) {
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
          messages={messages}
          fetchState={fetchState}
          whom={whom}
          scrollTo={scrollTo}
          scrollerRef={scrollerRef}
          scrollElementRef={scrollElementRef}
          isScrolling={isScrolling}
          topLoadEndMarker={prefixedElement}
          onAtTop={onAtTop}
          onAtBottom={onAtBottom}
        />
      </div>
      {scrollTo && !window?.latest ? (
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
