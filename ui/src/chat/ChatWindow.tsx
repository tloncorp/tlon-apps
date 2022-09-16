import React, { ReactNode } from 'react';
import _ from 'lodash';
import { BigIntOrderedMap } from '@urbit/api';
import bigInt from 'big-integer';
import { useChatState } from '@/state/chat';
import ChatUnreadAlerts from '@/chat/ChatUnreadAlerts';
import { ChatWrit } from '@/types/chat';
import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import { useLocation } from 'react-router';

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
  const brief = useChatState((s) => s.briefs[whom]);
  const location = useLocation();
  const scrollTo = new URLSearchParams(location.search).get('msg');

  return (
    <div className="relative h-full">
      <ChatUnreadAlerts brief={brief} whom={whom} />
      <div className="flex h-full w-full flex-col overflow-hidden px-2">
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
