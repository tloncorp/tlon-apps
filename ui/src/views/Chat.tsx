import React, { useEffect } from 'react';
import ChatInput from '../components/ChatInput/ChatInput';
import ChatMessage from '../components/ChatMessage/ChatMessage';
import api from '../api';
import { useChatState, useMessagesForChat } from '../state/chat';
import Layout from '../components/layout/Layout';

const DEF_FLAG = '~zod/test';

export default function Chat() {
  const messages = useMessagesForChat(DEF_FLAG);

  useEffect(() => {
    useChatState.getState().initialize('~zod/test');

    return () => {
      api.reset();
    };
  }, []);

  return (
    <Layout
      footer={
        <div className="p-4">
          <ChatInput flag={DEF_FLAG} />
        </div>
      }
      main={
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
      }
    />
  );
}
