import { Editor } from '@tiptap/react';
import cn from 'classnames';
import _ from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePact } from '@/state/chat';
import { ChatImage, ChatMemo, Cite } from '@/types/chat';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import X16Icon from '@/components/icons/X16Icon';
import {
  fetchChatBlocks,
  useChatBlocks,
  useChatInfo,
  useChatStore,
} from '@/chat/useChatStore';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import { useIsMobile } from '@/logic/useMedia';
import { normalizeInline, JSONToInlines, makeMention } from '@/logic/tiptap';
import { Inline } from '@/types/content';
import AddIcon from '@/components/icons/AddIcon';
import ArrowNWIcon16 from '@/components/icons/ArrowNIcon16';
import { useFileStore, useUploader } from '@/state/storage';
import {
  IMAGE_REGEX,
  REF_REGEX,
  isImageUrl,
  pathToCite,
  URL_REGEX,
} from '@/logic/utils';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import * as Popover from '@radix-ui/react-popover';
import { useSubscriptionStatus } from '@/state/local';
import { useSearchParams } from 'react-router-dom';
import { useGroupFlag } from '@/state/groups';

interface ChatInputProps {
  whom: string;
  replying?: string;
  autoFocus?: boolean;
  showReply?: boolean;
  className?: string;
  sendDisabled?: boolean;
  sendMessage: (whom: string, memo: ChatMemo) => void;
  inThread?: boolean;
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
  inThread = false,
}: ChatInputProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const chatReplyId = useMemo(
    () => searchParams.get('chat_reply'),
    [searchParams]
  );
  const [replyCite, setReplyCite] = useState<{ cite: Cite }>();
  const groupFlag = useGroupFlag();
  const subscription = useSubscriptionStatus();
  const pact = usePact(whom);
  const id = replying ? `${whom}-${replying}` : whom;
  const chatInfo = useChatInfo(id);
  const reply = replying || null;
  // const replyingWrit = reply && pact.writs.get(pact.index[reply]);
  const replyingWrit = chatReplyId && pact.writs.get(pact.index[chatReplyId]);
  const ship = replyingWrit && replyingWrit.memo.author;
  const isMobile = useIsMobile();
  const uploadKey = `chat-input-${id}`;
  const uploader = useUploader(uploadKey);
  const files = uploader?.files;
  const mostRecentFile = uploader?.getMostRecent();
  const { setBlocks } = useChatStore.getState();

  const closeReply = useCallback(() => {
    setSearchParams({}, { replace: true });
    setReplyCite(undefined);
  }, [setSearchParams]);

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
    useChatStore.getState().setBlocks(id, []);
    useFileStore.getState().getUploader(uploadKey)?.clear();
    if (replyCite) {
      closeReply();
    }
  }, [id, uploadKey, closeReply, replyCite]);

  // update the Attached Items view when files finish uploading and have a size
  useEffect(() => {
    if (
      id &&
      files &&
      Object.values(files).length &&
      !_.some(Object.values(files), (f) => f.size === undefined)
    ) {
      // TODO: handle existing blocks (other refs)
      useChatStore.getState().setBlocks(
        id,
        Object.values(files).map((f) => ({
          image: {
            src: f.url, // TODO: what to put when still loading?
            width: f.size[0],
            height: f.size[1],
            alt: f.file.name,
          },
        }))
      );
    }
  }, [files, id]);

  const onSubmit = useCallback(
    async (editor: Editor) => {
      if (sendDisabled) return;
      const blocks = fetchChatBlocks(id);
      if (!editor.getText() && !blocks.length && !replyCite) {
        return;
      }

      const data = normalizeInline(
        JSONToInlines(editor?.getJSON()) as Inline[]
      );

      const text = editor.getText();
      const textIsImageUrl = isImageUrl(text);

      if (textIsImageUrl) {
        const url = text;
        const name = 'chat-image';

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
              block: [...blocks, ...(replyCite ? [replyCite] : [])],
            },
          },
        };

        sendMessage(whom, memo);
      }
      editor?.commands.setContent('');
      setTimeout(() => {
        useChatStore.getState().read(whom);
        clearAttachments();
      }, 0);
    },
    [whom, id, clearAttachments, sendMessage, sendDisabled, reply, replyCite]
  );

  /**
   * !!! CAUTION !!!
   *
   * Anything passed to this hook which causes a recreation of the editor
   * will cause it to lose focus, tread with caution.
   *
   */
  const messageEditor = useMessageEditor({
    whom: id,
    content: '',
    uploadKey,
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

  useEffect(() => {
    if (whom && messageEditor && !messageEditor.isDestroyed) {
      messageEditor?.commands.setContent('');
    }
  }, [whom, messageEditor]);

  useEffect(() => {
    if (
      (autoFocus || replyCite) &&
      !isMobile &&
      messageEditor &&
      !messageEditor.isDestroyed
    ) {
      messageEditor.commands.focus();
    }
  }, [autoFocus, replyCite, isMobile, messageEditor]);

  useEffect(() => {
    if (
      chatReplyId &&
      messageEditor &&
      !messageEditor.isDestroyed &&
      !inThread
    ) {
      messageEditor?.commands.focus();
      const mention = ship ? makeMention(ship.slice(1)) : null;
      messageEditor?.commands.setContent(mention);
      messageEditor?.commands.insertContent(': ');
      const path = `/1/chan/chat/${id}/msg/${chatReplyId}`;
      const cite = path ? pathToCite(path) : undefined;
      if (cite && !replyCite) {
        setReplyCite({ cite });
      }
    }
  }, [
    chatReplyId,
    id,
    setReplyCite,
    replyCite,
    groupFlag,
    messageEditor,
    ship,
    inThread,
  ]);

  const editorText = messageEditor?.getText();
  const editorHTML = messageEditor?.getHTML();

  useEffect(() => {
    if (/Android \d/.test(navigator.userAgent)) {
      // Android's Gboard doesn't send a clipboard event when pasting
      // so we have to use a hacky workaround to detect pastes for refs
      // https://github.com/ProseMirror/prosemirror/issues/1206
      if (messageEditor && !messageEditor.isDestroyed && editorText !== '') {
        if (editorText?.match(REF_REGEX)) {
          const path = editorText.match(REF_REGEX)?.[0];
          const cite = path ? pathToCite(path) : undefined;
          if (!cite || !path) {
            return;
          }
          if (!whom) {
            return;
          }
          setBlocks(whom, [{ cite }]);
          messageEditor.commands.deleteRange({
            from: editorText.indexOf(path),
            to: editorText.indexOf(path) + path.length + 1,
          });
        }
        if (editorText?.match(URL_REGEX)) {
          const url = editorText.match(URL_REGEX)?.[0];
          if (!url) {
            return;
          }
          const urlIncluded = editorHTML?.includes(
            `<a target="_blank" rel="noopener noreferrer nofollow" href="${url}">${url}</a>`
          );
          if (urlIncluded) {
            return;
          }
          messageEditor
            .chain()
            .setTextSelection({
              from: editorText.indexOf(url),
              to: editorText.indexOf(url) + url.length + 1,
            })
            .setLink({ href: url })
            .selectTextblockEnd()
            .run();
        }
      }
    }
  }, [messageEditor, editorText, editorHTML, whom, setBlocks]);

  const onClick = useCallback(
    () => messageEditor && onSubmit(messageEditor),
    [messageEditor, onSubmit]
  );

  const onRemove = useCallback(
    (idx: number) => {
      const blocks = fetchChatBlocks(whom);
      if ('image' in blocks[idx]) {
        // @ts-expect-error type check on previous line
        uploader.removeByURL(blocks[idx]);
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

          {showReply && ship && chatReplyId ? (
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
              <Avatar size="xs" ship={window.our} className="mr-2 mb-1" />
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
          onMouseDown={(e) => {
            e.preventDefault();
            onClick();
          }}
        >
          {isMobile ? <ArrowNWIcon16 className="h-4 w-4" /> : 'Send'}
        </button>
      </div>
      {isMobile ? <ChatInputMenu editor={messageEditor} /> : null}
    </>
  );
}
