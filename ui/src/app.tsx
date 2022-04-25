import React, { useEffect } from 'react';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import api from './api';
import { useChatState, useMessagesForChat } from './state/chat';

const DEF_FLAG = '~zod/test';

export default function App() {
  const messages = useMessagesForChat(DEF_FLAG);

  useEffect(() => {
    useChatState.getState().initialize('~zod/test');

    return () => {
      api.reset();
    };
  }, []);

  return (
    <main>
      <div className="flex h-screen w-full flex-col justify-end space-y-6 p-4">
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
        <ChatInput flag={DEF_FLAG} />
      </div>
    </main>
  );
}
