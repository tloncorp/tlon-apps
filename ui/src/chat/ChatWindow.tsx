import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import _ from 'lodash';
import bigInt from 'big-integer';
import { useSearchParams } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';
import ChatUnreadAlerts from '@/chat/ChatUnreadAlerts';
import { useChatState, useMessagesForChat } from '@/state/chat';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import ArrowS16Icon from '@/components/icons/ArrowS16Icon';
import { useChatInfo, useChatStore } from './useChatStore';
import ChatScrollerPlaceholder from './ChatScoller/ChatScrollerPlaceholder';

interface ChatWindowProps {
  whom: string;
  prefixedElement?: ReactNode;
}

export default function ChatWindow({ whom, prefixedElement }: ChatWindowProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollTo = useMemo(() => {
    const msg = searchParams.get('msg');
    return msg ? bigInt(msg) : undefined;
  }, [searchParams]);
  const messages = useMessagesForChat(whom, scrollTo);
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const readTimeout = useChatInfo(whom).unread?.readTimeout;

  const goToLatest = useCallback(() => {
    setSearchParams({});
    scrollerRef.current?.scrollToIndex({ index: 'LAST', align: 'end' });
  }, [setSearchParams]);

  useEffect(() => {
    if (scrollTo && !messages.has(scrollTo)) {
      useChatState.getState().fetchMessagesAround(whom, '25', scrollTo);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo?.toString()]);

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

  if (messages.size === 0) {
    return (
      <div className="h-full">
        <ChatScrollerPlaceholder count={30} />
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <ChatUnreadAlerts whom={whom} scrollerRef={scrollerRef} />
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
          whom={whom}
          prefixedElement={prefixedElement}
          scrollTo={scrollTo}
          scrollerRef={scrollerRef}
        />
      </div>
      {scrollTo ? (
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
