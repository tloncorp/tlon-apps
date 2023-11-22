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
import { dmListPath } from '@/logic/utils';
import MessageSelector from './MessageSelector';

export default function NewDM() {
  const {
    sendDm,
    validShips,
    whom,
    isMultiDm,
    confirmedMultiDmMismatch,
    existingMultiDm,
  } = useMessageSelector();
  const dropZoneId = 'chat-new-dm-input-dropzone';
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const isMobile = useIsMobile();
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);
  const { isChatInputFocused } = useChatInputFocus();
  const shouldApplyPaddingBottom = isMobile && !isChatInputFocused;
  const shouldBlockInput =
    isMultiDm && !existingMultiDm && confirmedMultiDmMismatch;

  return (
    <Layout
      className="flex-1"
      style={{
        paddingBottom: shouldApplyPaddingBottom ? 50 : 0,
      }}
      header={
        isMobile && <MobileHeader title="New Message" pathBack={dmListPath} />
      }
      footer={
        shouldBlockInput ? (
          <div className="rounded-lg border-2 border-transparent bg-gray-50 py-1 px-2 leading-5 text-gray-600">
            Your version of the app does not match some of the members of this
            chat.
          </div>
        ) : (
          <div
            className={cn(
              isDragging || isOver ? '' : 'border-t-2 border-gray-50 p-4'
            )}
          >
            <ChatInput
              whom={whom}
              showReply
              sendDisabled={!validShips}
              sendDm={sendDm}
              dropZoneId={dropZoneId}
              isScrolling={isScrolling}
            />
          </div>
        )
      }
    >
      <MessageSelector />
    </Layout>
  );
}
