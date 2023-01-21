import React from 'react';
import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import useMessageSelector from '@/logic/useMessageSelector';
import MessageSelector from './MessageSelector';

export default function NewDM() {
  const { existingDm, existingMultiDm, sendDm, validShips, whom } =
    useMessageSelector();

  const action = existingDm || existingMultiDm ? 'Open' : 'Create';

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
      {validShips ? (
        <div className="flex h-full flex-1 flex-col items-center justify-center">
          <div className="flex w-fit flex-col items-center justify-center rounded-md border border-dashed border-gray-200 p-8">
            <div className="text-lg text-gray-500">Press Enter to {action}</div>
            <div className="text-md text-gray-300">or</div>
            <div className="text-lg text-gray-500">Add More Ships</div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
}
