import React, { useEffect } from 'react';
import ChatMessage from './ChatMessage/ChatMessage';
import { useChatState, useMessagesForChat } from '../state/chat';

export default function ChatWindow(props: { flag: string }) {
  const { flag } = props;
  const messages = useMessagesForChat(flag);

  useEffect(() => {
    useChatState.getState().initialize(flag);
  }, [flag]);

  return (
    <div className="flex h-full w-full flex-col overflow-auto p-4">
      <div className="mt-auto flex flex-col justify-end space-y-4">
        {messages
          .keys()
          .reverse()
          .map((key, index) => {
            const writ = messages.get(key);
            const lastWrit =
              index > 0
                ? messages.get(messages.keys().reverse()[index - 1])
                : undefined;
            const newAuthor = lastWrit
              ? writ.memo.author !== lastWrit.memo.author
              : true;
            return (
              <ChatMessage
                key={writ.seal.time}
                writ={writ}
                newAuthor={newAuthor}
              />
            );
          })}
      </div>
    </div>
  );
}
