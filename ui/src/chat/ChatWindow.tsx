import React, { ReactNode, useEffect } from 'react';
import _ from 'lodash';
import { BigIntOrderedMap } from '@urbit/api';
import bigInt from 'big-integer';
import { useChatState } from '@/state/chat';
import ChatUnreadAlerts from '@/chat/ChatUnreadAlerts';
import { ChatWrit } from '@/types/chat';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import { useLocation } from 'react-router';
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
          messages={messages}
          whom={whom}
          prefixedElement={prefixedElement}
          scrollTo={scrollTo ? bigInt(scrollTo) : undefined}
        />
      </div>
    </div>
  );
}
