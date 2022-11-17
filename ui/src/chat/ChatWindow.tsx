import React, { ReactNode, useEffect } from 'react';
import _ from 'lodash';
import { BigIntOrderedMap } from '@urbit/api';
import bigInt from 'big-integer';
import { useLocation } from 'react-router';
import ChatUnreadAlerts from '@/chat/ChatUnreadAlerts';
import { ChatWrit } from '@/types/chat';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import { useChatStore } from './useChatStore';

interface ChatWindowProps {
  whom: string;
  messages: BigIntOrderedMap<ChatWrit>;
  prefixedElement?: ReactNode;
}

export default function ChatWindow({
  whom,
  messages,
  prefixedElement,
}: ChatWindowProps) {
  const location = useLocation();
  const scrollTo = new URLSearchParams(location.search).get('msg');

  useEffect(() => {
    useChatStore.getState().setCurrent(whom);
  }, [whom]);

  return (
    <div className="relative h-full">
      <ChatUnreadAlerts whom={whom} />
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
          scrollTo={scrollTo ? bigInt(scrollTo) : undefined}
        />
      </div>
    </div>
  );
}
