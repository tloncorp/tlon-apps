import React, { ReactNode } from 'react';
import _ from 'lodash';
import { BigIntOrderedMap } from '@urbit/api';
import { useChatState } from '../state/chat';
import ChatUnreadAlerts from './ChatUnreadAlerts';
import { ChatWrit } from '../types/chat';
import ChatScroller from './ChatScroller/ChatScroller';

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

  return (
    <div className="relative h-full">
      <ChatUnreadAlerts brief={brief} whom={whom} />
      <div className="flex h-full w-full flex-col overflow-hidden p-4">
        <ChatScroller
          messages={messages}
          whom={whom}
          prefixedElement={prefixedElement}
        />
      </div>
    </div>
  );
}
