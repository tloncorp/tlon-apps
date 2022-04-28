import React from 'react';
import { useMessagesForChat } from '../../state/chat';
import ChatMessage from '../chat-message/ChatMessage';

const DEF_FLAG = '~zod/test';

export default function ChatScroll() {
  const messages = useMessagesForChat(DEF_FLAG);
  return (
    <div className="space-y-4">
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
          return <ChatMessage key={writ.seal.time} writ={writ} newAuthor={newAuthor} />;
        })}
    </div>
  );
}
