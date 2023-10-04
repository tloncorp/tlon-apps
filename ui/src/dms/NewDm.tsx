import React, { useRef } from 'react';
import cn from 'classnames';
import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import useMessageSelector from '@/logic/useMessageSelector';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { isNativeApp } from '@/logic/native';
import MobileHeader from '@/components/MobileHeader';
import MessageSelector from './MessageSelector';

export default function NewDM() {
  const { sendDm, validShips, whom } = useMessageSelector();
  const dropZoneId = 'chat-new-dm-input-dropzone';
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  return (
    <Layout
      className="flex-1"
      header={
        isNativeApp() && (
          <MobileHeader title="New Message" pathBack="/messages" />
        )
      }
      footer={
        <div
          className={cn(
            isDragging || isOver ? '' : 'border-t-2 border-gray-50 p-4'
          )}
        >
          <ChatInput
            whom={whom}
            showReply
            sendDisabled={!validShips}
            sendMessage={sendDm}
            dropZoneId={dropZoneId}
            scrollElementRef={scrollElementRef}
          />
        </div>
      }
    >
      <MessageSelector />
    </Layout>
  );
}
