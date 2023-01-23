import React, { useEffect } from 'react';
import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import useMessageSelector from '@/logic/useMessageSelector';
import MessageSelector from './MessageSelector';

export default function NewDM() {
  const { sendDm, validShips, whom } = useMessageSelector();

  return (
    <Layout
      className="flex-1"
      footer={
        <div className="border-t-2 border-gray-50 p-4">
          <ChatInput
            whom={whom}
            showReply
            sendDisabled={!validShips}
            sendMessage={sendDm}
          />
        </div>
      }
    >
      <MessageSelector />
    </Layout>
  );
}
