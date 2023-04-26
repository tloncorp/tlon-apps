import React, { useEffect, useRef } from 'react';
import bigInt from 'big-integer';
import { useLocation, useParams } from 'react-router';
import { VirtuosoHandle } from 'react-virtuoso';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import { useChatStore } from '@/chat/useChatStore';
import { ChatWrit } from '@/types/chat';
import { BigIntOrderedMap } from '@urbit/api';
import { useChatSearch } from '@/state/chat';

interface ChatSearchResultsProps {
  whom: string;
  messages: BigIntOrderedMap<ChatWrit>;
}

export default function ChatSearchResults({
  whom,
  messages,
}: ChatSearchResultsProps) {
  const location = useLocation();
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const scrollTo = new URLSearchParams(location.search).get('msg');
  const { query } = useParams<{ query: string }>();
  const { scan } = useChatSearch(whom, query || '');

  useEffect(() => {
    useChatStore.getState().setCurrent(whom);
  }, [whom]);

  return (
    <div className="relative h-full">
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
          messages={scan.size === 0 ? messages : scan}
          whom={whom}
          // prefixedElement={prefixedElement}
          scrollTo={scrollTo ? bigInt(scrollTo) : undefined}
          scrollerRef={scrollerRef}
        />
      </div>
    </div>
  );
}
