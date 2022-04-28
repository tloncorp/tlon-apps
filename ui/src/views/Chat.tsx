import React, { useEffect } from 'react';
import ChatMessage from '../components/chat-message/ChatMessage';
import ChatInput from '../components/ChatInput';
import api from '../api';
import { useChatState, useMessagesForChat } from '../state/chat';
import Layout from '../components/layout/Layout';
import { version } from '../../package.json';

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
      header={
        <div className="flex items-center justify-center h-full">
          <h1 className="text-3xl font-bold text-blue">Welcome to homestead</h1>
        </div>
      }
      footer={
        <div className="flex items-center justify-center h-full">
          <span className="text-gray-300">homestead {version}</span>
        </div>
      }
      main={
        <div className="flex items-center justify-center min-h-screen">
          <div className="max-w-md py-20 space-y-6">
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
                  return (
                    <ChatMessage
                      key={writ.seal.time}
                      writ={writ}
                      newAuthor={newAuthor}
                    />
                  );
                })}
            </div>
            <ChatInput flag={DEF_FLAG} />
          </div>
        </div>
      }
    />
  );
}
