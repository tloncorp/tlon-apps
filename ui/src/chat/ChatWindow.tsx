import React, { useEffect } from 'react';
import _ from 'lodash';
import { useChatState, useMessagesForChat } from '../state/chat';
import ChatMessages from './ChatMessages';

export default function ChatWindow({ flag }: { flag: string }) {
  useEffect(() => {
    useChatState.getState().initialize(flag);
  }, [flag]);
  const messages = useMessagesForChat(flag);

  return (
    <div className="flex h-full w-full flex-col overflow-auto px-4 pb-4">
      <div className="mt-auto flex flex-col justify-end">
        <ChatMessages messages={messages} whom={flag} />
      </div>
    </div>
  );
}
