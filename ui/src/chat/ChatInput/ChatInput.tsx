import { Editor } from '@tiptap/react';
import { findLast } from 'lodash';
import cn from 'classnames';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePact } from '@/state/chat';
import { ChatMemo } from '@/types/chat';
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
import useFileUpload from '@/logic/useFileUpload';
import { useFileStore } from '@/state/storage';
import { isImageUrl } from '@/logic/utils';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import * as Popover from '@radix-ui/react-popover';

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
            {/*
              <button className="small-button mt-4 w-[84px]">Learn more</button>
            */}
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
  const pact = usePact(whom);
  const chatInfo = useChatInfo(whom);
  const reply = replying || chatInfo?.replying || null;
  const replyingWrit = reply && pact.writs.get(pact.index[reply]);
  const ship = replyingWrit && replyingWrit.memo.author;
  const isMobile = useIsMobile();
  const { loaded, hasCredentials, promptUpload } = useFileUpload();
  const fileId = useRef(`chat-input-${Math.floor(Math.random() * 1000000)}`);
  const mostRecentFile = useFileStore((state) =>
    findLast(state.files, ['for', fileId.current])
  );

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

        fileId.current = `chat-input-${Math.floor(Math.random() * 1000000)}`;
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
      setTimeout(() => closeReply(), 0);
      useChatStore.getState().setBlocks(whom, []);
    },
    [reply, whom, sendMessage, closeReply, mostRecentFile]
  );

  const messageEditor = useMessageEditor({
    whom,
    content: '',
    placeholder: 'Message',
    allowMentions: true,
    onEnter: useCallback(
      ({ editor }) => {
        onSubmit(editor);
        return true;
      },
      [onSubmit]
    ),
  });

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
    if (mostRecentFile && messageEditor && !messageEditor.isDestroyed) {
      const { url } = mostRecentFile;
      messageEditor.commands.setContent(null);
      messageEditor.commands.setContent(url);
    }
  }, [mostRecentFile, messageEditor]);

  useEffect(() => {
    if (messageEditor && !messageEditor.isDestroyed) {
      if (mostRecentFile) {
        // if there is a most recent file, we want to set the content to the url
        const { url } = mostRecentFile;

        messageEditor.commands.setContent(url);
      } else {
        // if the draft is empty, clear the editor
        messageEditor.commands.setContent(null, true);
      }
    }
  }, [messageEditor, mostRecentFile]);

  const onClick = useCallback(
    () => messageEditor && onSubmit(messageEditor),
    [messageEditor, onSubmit]
  );

  if (!messageEditor) {
    return null;
  }

  return (
    <>
      <div className={cn('flex w-full items-end space-x-2', className)}>
        <div className="flex-1">
          {chatInfo.blocks.length > 0 ? (
            <div className="mb-4 flex items-center justify-start font-semibold">
              <span className="mr-2 text-gray-600">Attached: </span>
              {chatInfo.blocks.length} reference
              {chatInfo.blocks.length === 1 ? '' : 's'}
              <button
                className="icon-button ml-auto"
                onClick={() => useChatStore.getState().setBlocks(whom, [])}
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
          <div className="flex items-center justify-end">
            <Avatar size="xs" ship={window.our} className="mr-2" />
            <MessageEditor
              editor={messageEditor}
              className="w-full break-words"
            />
            {loaded &&
            hasCredentials &&
            !uploadError &&
            mostRecentFile?.status !== 'loading' ? (
              <button
                title={'Upload an image'}
                className="absolute mr-2 text-gray-600 hover:text-gray-800"
                aria-label="Add attachment"
                onClick={() => promptUpload(fileId.current)}
              >
                <AddIcon className="h-6 w-4" />
              </button>
            ) : null}
            {mostRecentFile && mostRecentFile.status === 'loading' ? (
              <LoadingSpinner className="absolute mr-2 h-4 w-4" />
            ) : null}
            {uploadError ? (
              <div className="absolute mr-2">
                <UploadErrorPopover
                  errorMessage={uploadError}
                  setUploadError={setUploadError}
                />
              </div>
            ) : null}
          </div>
        </div>
        <button
          className="button"
          disabled={
            sendDisabled ||
            (messageEditor.getText() === '' && chatInfo.blocks.length === 0)
          }
          onClick={onClick}
        >
          Send
        </button>
      </div>
      {isMobile && messageEditor.isFocused ? (
        <ChatInputMenu editor={messageEditor} />
      ) : null}
    </>
  );
}
