import React, { useRef } from 'react';
import cn from 'classnames';
import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import useMessageSelector from '@/logic/useMessageSelector';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import MobileHeader from '@/components/MobileHeader';
import { useIsScrolling } from '@/logic/scroll';
import { useIsMobile } from '@/logic/useMedia';
import { useChatInputFocus } from '@/logic/ChatInputFocusContext';
import MessageSelector from './MessageSelector';

export default function NewDM() {
  const { sendDm, validShips, whom } = useMessageSelector();
  const dropZoneId = 'chat-new-dm-input-dropzone';
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const isMobile = useIsMobile();
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);
  const { isChatInputFocused } = useChatInputFocus();
  const shouldApplyPaddingBottom = isMobile && !isChatInputFocused;

  return (
    <Layout
      className="flex-1"
      style={{
        paddingBottom: shouldApplyPaddingBottom ? 50 : 0,
      }}
      header={
        isMobile && <MobileHeader title="New Message" pathBack="/messages" />
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
            isScrolling={isScrolling}
          />
        </div>
      }
    >
      <MessageSelector />
    </Layout>
  );
}
