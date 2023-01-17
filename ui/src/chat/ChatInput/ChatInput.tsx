import { Editor } from '@tiptap/react';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { usePact } from '@/state/chat';
import { ChatImage, ChatMemo } from '@/types/chat';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import X16Icon from '@/components/icons/X16Icon';
import {
  fetchChatBlocks,
  useChatInfo,
  useChatStore,
} from '@/chat/useChatStore';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import { useIsMobile } from '@/logic/useMedia';
import { normalizeInline, JSONToInlines } from '@/logic/tiptap';
import { Inline } from '@/types/content';
import AddIcon from '@/components/icons/AddIcon';
import ArrowNWIcon16 from '@/components/icons/ArrowNIcon16';
import { useUploader } from '@/state/storage';
import { IMAGE_REGEX, isImageUrl } from '@/logic/utils';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import * as Popover from '@radix-ui/react-popover';
import { useSubscriptionStatus } from '@/state/local';

interface ChatInputProps {
  whom: string;
  replying?: string;
  autoFocus?: boolean;
  showReply?: boolean;
  className?: string;
  sendDisabled?: boolean;
  sendMessage: (whom: string, memo: ChatMemo) => void;
}

export function UploadErrorPopover({
  errorMessage,
  setUploadError,
}: {
  errorMessage: string;
  setUploadError: (error: string | null) => void;
}) {
  return (
    <Popover.Root open>
      <Popover.Anchor>
        <AddIcon className="h-6 w-4 text-gray-600" />
      </Popover.Anchor>
      <Popover.Content
        sideOffset={5}
        onEscapeKeyDown={() => setUploadError(null)}
        onPointerDownOutside={() => setUploadError(null)}
      >
        <div className="flex w-[200px] flex-col items-center justify-center rounded-lg bg-white p-4 leading-5 drop-shadow-lg">
          <span className="mb-2 font-semibold text-gray-800">
            This file can't be posted.
          </span>
          <div className="flex flex-col justify-start">
            <span className="mt-2 text-gray-800">{errorMessage}</span>
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}

export default function ChatInput({
  whom,
  replying,
  autoFocus,
  className = '',
  showReply = false,
  sendDisabled = false,
  sendMessage,
}: ChatInputProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const subscription = useSubscriptionStatus();
  const pact = usePact(whom);
  const chatInfo = useChatInfo(whom);
  const reply = replying || chatInfo?.replying || null;
  const replyingWrit = reply && pact.writs.get(pact.index[reply]);
  const ship = replyingWrit && replyingWrit.memo.author;
  const isMobile = useIsMobile();
  const uploader = useUploader(`chat-input-${whom}-${replying}`);
  const mostRecentFile = uploader?.getMostRecent();

  const closeReply = useCallback(() => {
    useChatStore.getState().reply(whom, null);
  }, [whom]);

  useEffect(() => {
    if (
      mostRecentFile &&
      mostRecentFile.status === 'error' &&
      mostRecentFile.errorMessage
    ) {
      setUploadError(mostRecentFile.errorMessage);
    }
  }, [mostRecentFile]);

  const clearAttachments = useCallback(() => {
    useChatStore.getState().setBlocks(whom, []);
    uploader?.clear();
  }, [whom, uploader]);

  const onSubmit = useCallback(
    async (editor: Editor) => {
      const blocks = fetchChatBlocks(whom);
      if (!editor.getText() && !blocks.length) {
        return;
      }

      const data = normalizeInline(
        JSONToInlines(editor?.getJSON()) as Inline[]
      );

      const text = editor.getText();
      const textIsImageUrl = isImageUrl(text);

      if (textIsImageUrl) {
        let url = text;
        let name = 'chat-image';

        if (mostRecentFile) {
          url = mostRecentFile.url;
          name = mostRecentFile.file.name;
        }

        const img = new Image();
        img.src = url;

        img.onload = () => {
          const { width, height } = img;

          sendMessage(whom, {
            replying: reply,
            author: `~${window.ship || 'zod'}`,
            sent: Date.now(),
            content: {
              story: {
                inline: [],
                block: [
                  {
                    image: {
                      src: url,
                      alt: name,
                      width,
                      height,
                    },
                  },
                ],
              },
            },
          });
        };
      } else {
        const memo: ChatMemo = {
          replying: reply,
          author: `~${window.ship || 'zod'}`,
          sent: 0, // wait until ID is created so we can share time
          content: {
            story: {
              inline: Array.isArray(data) ? data : [data],
              block: blocks,
            },
          },
        };

        sendMessage(whom, memo);
      }
      editor?.commands.setContent('');
      useChatStore.getState().read(whom);
      setTimeout(() => closeReply(), 0);
      clearAttachments();
    },
    [whom, clearAttachments, mostRecentFile, sendMessage, reply, closeReply]
  );

  const messageEditor = useMessageEditor({
    whom,
    content: '',
    uploader,
    placeholder: 'Message',
    allowMentions: true,
    onEnter: useCallback(
      ({ editor }) => {
        if (subscription === 'connected') {
          onSubmit(editor);
          return true;
        }
        return false;
      },
      [onSubmit, subscription]
    ),
  });

  const text = messageEditor?.getText();

  useEffect(() => {
    if (whom && messageEditor && !messageEditor.isDestroyed) {
      messageEditor?.commands.setContent('');
    }
  }, [whom, messageEditor]);

  useEffect(() => {
    if (
      (autoFocus || reply) &&
      !isMobile &&
      messageEditor &&
      !messageEditor.isDestroyed
    ) {
      messageEditor.commands.focus();
    }
  }, [autoFocus, reply, isMobile, messageEditor]);

  useEffect(() => {
    if (messageEditor && !messageEditor.isDestroyed) {
      // if the draft is empty, clear the editor
      messageEditor.commands.setContent(null, true);
    }
  }, [messageEditor]);

  const onClick = useCallback(
    () => messageEditor && onSubmit(messageEditor),
    [messageEditor, onSubmit]
  );

  const onRemove = useCallback(
    (idx: number) => {
      const blocks = fetchChatBlocks(whom);
      if ('image' in blocks[idx]) {
        // @ts-expect-error type check on previous line
        uploader.removeFileByURL(blocks[idx]);
      }
      useChatStore.getState().setBlocks(
        whom,
        blocks.filter((_b, k) => k !== idx)
      );
    },
    [whom, uploader]
  );

  if (!messageEditor) {
    return null;
  }

  // @ts-expect-error tsc is not tracking the type narrowing in the filter
  const imageBlocks: ChatImage[] = chatInfo.blocks.filter((b) => 'image' in b);

  return (
    <>
      <div className={cn('flex w-full items-end space-x-2', className)}>
        <div className="flex-1">
          {imageBlocks.length > 0 ? (
            <div className="mb-2 flex flex-wrap items-center">
              {imageBlocks.map((img, idx) => (
                <div key={idx} className="relative p-1.5">
                  <button
                    onClick={() => onRemove(idx)}
                    className="icon-button absolute top-4 right-4"
                  >
                    <X16Icon className="h-4 w-4" />
                  </button>
                  {IMAGE_REGEX.test(img.image.src) ? (
                    <img
                      title={img.image.alt}
                      src={img.image.src}
                      className="h-32 w-32 object-cover"
                    />
                  ) : (
                    <div
                      title={img.image.alt}
                      className="h-32 w-32 animate-pulse bg-gray-200"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {chatInfo.blocks.length > 0 ? (
            <div className="mb-4 flex items-center justify-start font-semibold">
              <span className="mr-2 text-gray-600">Attached: </span>
              {chatInfo.blocks.length}{' '}
              {chatInfo.blocks.every((b) => 'image' in b)
                ? 'image'
                : 'reference'}
              {chatInfo.blocks.length === 1 ? '' : 's'}
              <button
                className="icon-button ml-auto"
                onClick={clearAttachments}
              >
                <X16Icon className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {showReply && ship && reply ? (
            <div className="mb-4 flex items-center justify-start font-semibold">
              <span className="text-gray-600">Replying to</span>
              <Avatar size="xs" ship={ship} className="ml-2" />
              <ShipName name={ship} showAlias className="ml-2" />
              <button className="icon-button ml-auto" onClick={closeReply}>
                <X16Icon className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <div className="relative flex items-end justify-end">
            {!isMobile && (
              <Avatar size="xs" ship={window.our} className="mr-2" />
            )}
            <MessageEditor
              editor={messageEditor}
              className={cn(
                'w-full break-words',
                uploader && !uploadError && mostRecentFile?.status !== 'loading'
                  ? 'pr-8'
                  : ''
              )}
            />
            {uploader &&
            !uploadError &&
            mostRecentFile?.status !== 'loading' ? (
              <button
                title={'Upload an image'}
                className="absolute bottom-2 mr-2 text-gray-600 hover:text-gray-800"
                aria-label="Add attachment"
                onClick={() => uploader.prompt()}
              >
                <AddIcon className="h-4 w-4" />
              </button>
            ) : null}
            {mostRecentFile && mostRecentFile.status === 'loading' ? (
              <LoadingSpinner className="absolute bottom-2 mr-2 h-4 w-4" />
            ) : null}
            {uploadError ? (
              <div className="absolute bottom-2 mr-2">
                <UploadErrorPopover
                  errorMessage={uploadError}
                  setUploadError={setUploadError}
                />
              </div>
            ) : null}
          </div>
        </div>
        <button
          className={cn('button', isMobile && 'px-2')}
          disabled={
            sendDisabled ||
            subscription === 'reconnecting' ||
            subscription === 'disconnected' ||
            mostRecentFile?.status === 'loading' ||
            mostRecentFile?.status === 'error' ||
            (messageEditor.getText() === '' && chatInfo.blocks.length === 0)
          }
          onClick={onClick}
        >
          {isMobile ? <ArrowNWIcon16 className="h-4 w-4" /> : 'Send'}
        </button>
      </div>
      {isMobile ? <ChatInputMenu editor={messageEditor} /> : null}
    </>
  );
}
