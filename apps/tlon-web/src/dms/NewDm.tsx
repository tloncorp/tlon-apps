import cn from 'classnames';
import { useRef } from 'react';

import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import MobileHeader from '@/components/MobileHeader';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { useBottomPadding } from '@/logic/position';
import { useIsScrolling } from '@/logic/scroll';
import { useIsMobile } from '@/logic/useMedia';
import useMessageSelector from '@/logic/useMessageSelector';
import { dmListPath } from '@/logic/utils';

import MessageSelector from './MessageSelector';

export default function NewDM() {
  const {
    sendDm,
    validShips,
    whom,
    isMultiDm,
    existingMultiDm,
    multiDmVersionMismatch,
    haveAllNegotiations,
  } = useMessageSelector();
  const dropZoneId = 'chat-new-dm-input-dropzone';
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const isMobile = useIsMobile();
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);
  const { paddingBottom } = useBottomPadding();
  const shouldBlockInput =
    isMultiDm && !existingMultiDm && multiDmVersionMismatch;

  return (
    <Layout
      className="flex-1"
      style={{
        paddingBottom,
      }}
      header={
        isMobile && <MobileHeader title="New Message" pathBack={dmListPath} />
      }
      footer={
        shouldBlockInput ? (
          <div className="flex items-center justify-center border-2 border-transparent bg-gray-50 px-2 py-1 leading-5 text-gray-600">
            {haveAllNegotiations ? (
              'Your version of the app does not match some of the members of this chat.'
            ) : (
              <>
                <LoadingSpinner />
                <span className="ml-2">Checking version compatibility</span>
              </>
            )}
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
