import React, { useEffect } from 'react';
import _ from 'lodash';
import { BigIntOrderedMap } from '@urbit/api';
import { useChatState } from '../state/chat';
import ChatMessages from './ChatMessages';
import ChatUnreadAlerts from './ChatUnreadAlerts';
import { ChatWrit } from '../types/chat';

interface ChatWindowProps {
  whom: string;
  messages: BigIntOrderedMap<ChatWrit>;
}

export default function ChatWindow({ whom, messages }: ChatWindowProps) {
  const brief = useChatState((s) => s.briefs[whom]);

  return (
    <div className="relative h-full">
      <ChatUnreadAlerts brief={brief} whom={whom} />
      <div className="flex h-full w-full flex-col overflow-auto p-4">
        <div className="mt-auto flex flex-col justify-end">
          <ChatMessages messages={messages} whom={whom} />
        </div>
      </div>
    </div>
  );
}
