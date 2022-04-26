import React, { useEffect } from 'react';
import ChatMessage from '../components/ChatMessage';
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
        <div className='flex justify-center items-center h-full'>
          <h1 className="text-3xl font-bold text-blue">Welcome to homestead</h1>
        </div>
      }
      footer={
        <div className='flex justify-center items-center h-full'>
          <span className='text-gray-300'>
            homestead {version}
          </span>
        </div>
      }
      sidebar={
        <aside>test aside</aside>
      }
    >
      <main className="flex justify-center items-center min-h-screen">
        <div className="py-20 space-y-6 max-w-md">
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
    </Layout>
  );
}
