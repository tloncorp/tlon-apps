import React, { useEffect, useState } from 'react';
import { ChatWrit, ChatWrits } from './types/chat';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import api from './api';
import { useChatState, useMessagesForChat } from './state/chat';

const scryMessages = {
  app: 'chat',
  path: '/chat/~zod/test/fleet/newest/100',
};

export function App() {
  const messages = useMessagesForChat('~zod/test');
  console.log(messages);

  useEffect(() => {
    (async () => {
      useChatState.getState().initialize('~zod/test');
    })();

    return () => {
      api.reset();
    };
  }, []);

  return (
    <main className="flex justify-center items-center min-h-screen">
      <div className="py-20 space-y-6 max-w-md">
        <h1 className="text-3xl font-bold text-blue">Welcome to homestead</h1>
        <div className="space-y-4">
          {messages &&
            messages
              .keys()
              .reverse()
              .map((key) => {
                const writ = messages.get(key);
                return <ChatMessage key={writ.seal.time} writ={writ} />;
              })}
        </div>
        <ChatInput />
      </div>
    </main>
  );
}
