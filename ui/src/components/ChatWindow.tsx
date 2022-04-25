import React, { useEffect } from 'react';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import api from '../api';
import { useChatState, useMessagesForChat } from '../state/chat';

const DEF_FLAG = '~zod/test';

export default function ChatWindow(props: { flag: string }) {
  const { flag } = props;
  const messages = useMessagesForChat(flag);

  useEffect(() => {
    useChatState.getState().initialize(flag);

    return () => {};
  }, [flag]);

  return (
    <div className="h-100 flex flex-col grow">
      <div className="space-y-4 px-2 pt-2 overflow-y-scroll">
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
  );
}
