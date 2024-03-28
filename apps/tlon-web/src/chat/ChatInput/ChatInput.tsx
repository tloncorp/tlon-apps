import * as Popover from '@radix-ui/react-popover';
import { Editor } from '@tiptap/react';
import {
  CacheId,
  Cite,
  Memo,
  Nest,
  PostEssay,
  PostTuple,
  ReplyTuple,
} from '@tloncorp/shared/dist/urbit/channel';
import { WritTuple } from '@tloncorp/shared/dist/urbit/dms';
import cn from 'classnames';
import _, { debounce } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocalStorage } from 'usehooks-ts';

import {
  chatStoreLogger,
  fetchChatBlocks,
  useChatInfo,
  useChatStore,
} from '@/chat/useChatStore';
import Avatar from '@/components/Avatar';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import MessageEditor, {
  HandlerParams,
  useMessageEditor,
} from '@/components/MessageEditor';
import ShipName from '@/components/ShipName';
import AddIcon from '@/components/icons/AddIcon';
import ArrowNWIcon16 from '@/components/icons/ArrowNIcon16';
import X16Icon from '@/components/icons/X16Icon';
import { PASTEABLE_MEDIA_TYPES } from '@/constants';
import { useChatInputFocus } from '@/logic/ChatInputFocusContext';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import messageSender from '@/logic/messageSender';
import { inlinesToJSON, makeMention } from '@/logic/tiptap';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import useIsEditingMessage from '@/logic/useIsEditingMessage';
import { useIsMobile } from '@/logic/useMedia';
import {
  IMAGE_REGEX,
  REF_REGEX,
  URL_REGEX,
  VIDEO_REGEX,
  createStorageKey,
  pathToCite,
  useIsDmOrMultiDm,
  useThreadParentId,
} from '@/logic/utils';
import { useMyLastMessage } from '@/state/channel/channel';
import {
  SendMessageVariables,
  SendReplyVariables,
  useIsShipBlocked,
  useShipHasBlockedUs,
  useUnblockShipMutation,
} from '@/state/chat';
import { useGroupFlag } from '@/state/groups';
import { useFileStore, useUploader } from '@/state/storage';

interface ChatInputProps {
  whom: string;
  replying?: string;
  autoFocus?: boolean;
  showReply?: boolean;
  className?: string;
  sendDisabled?: boolean;
  sendDm?: (variables: SendMessageVariables) => void;
  sendDmReply?: (variables: SendReplyVariables) => void;
  sendChatMessage?: ({
    cacheId,
    essay,
  }: {
    cacheId: CacheId;
    essay: PostEssay;
  }) => void;
  sendReply?: ({
    nest,
    postId,
    memo,
    cacheId,
  }: {
    nest: Nest;
    postId: string;
    memo: Memo;
    cacheId: CacheId;
  }) => void;
  dropZoneId: string;
  replyingWrit?: PostTuple | WritTuple | ReplyTuple;
  isScrolling: boolean;
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
        <div className="flex w-[200px] flex-col items-center justify-center rounded-lg bg-white p-4 leading-5 shadow-xl">
          <span className="mb-2 font-semibold text-gray-800">
            This file can&apos;t be posted.
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
  sendDm,
  sendDmReply,
  sendChatMessage,
  sendReply,
  dropZoneId,
  replyingWrit,
  isScrolling,
}: ChatInputProps) {
  const { isDragging, isOver, droppedFiles, setDroppedFiles, targetId } =
    useDragAndDrop(dropZoneId);
  const { handleFocus, handleBlur, isChatInputFocused } = useChatInputFocus();
  const [didDrop, setDidDrop] = useState(false);
  const isTargetId = useMemo(
    () => targetId === dropZoneId,
    [targetId, dropZoneId]
  );
  const id = replying ? `${whom}-${replying}` : whom;
  const [draft, setDraft] = useLocalStorage(
    createStorageKey(`chat-${id}`),
    inlinesToJSON([''])
  );
  const threadParentId = useThreadParentId(whom);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [, setSearchParams] = useSearchParams();
  const isEditing = useIsEditingMessage();
  const [replyCite, setReplyCite] = useState<Cite>();
  const groupFlag = useGroupFlag();
  const { privacy } = useGroupPrivacy(groupFlag);
  const chatInfo = useChatInfo(id);
  const reply = replying || null;
  const ship =
    replyingWrit && replyingWrit[1] && 'essay' in replyingWrit[1]
      ? replyingWrit[1].essay.author
      : replyingWrit && replyingWrit[1] && 'memo' in replyingWrit[1]
        ? replyingWrit[1].memo.author
        : null;
  const isMobile = useIsMobile();
  const uploadKey = `chat-input-${id}`;
  const uploader = useUploader(uploadKey);
  const files = useMemo(() => uploader?.files, [uploader]);
  const mostRecentFile = uploader?.getMostRecent();
  const { setBlocks } = useChatStore.getState();
  const shipIsBlocked = useIsShipBlocked(whom);
  const shipHasBlockedUs = useShipHasBlockedUs(whom);
  const { mutate: unblockShip } = useUnblockShipMutation();
  const isDmOrMultiDM = useIsDmOrMultiDm(whom);
  const myLastMessage = useMyLastMessage(whom, replying);
  const lastMessageId = myLastMessage ? myLastMessage.seal.id : '';
  const lastMessageIdRef = useRef(lastMessageId);
  const isReplyingRef = useRef(!!replying);

  useEffect(() => {
    if (lastMessageId && lastMessageId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastMessageId;
    }
  }, [lastMessageId]);

  useEffect(() => {
    if (isReplyingRef.current && !replying) {
      isReplyingRef.current = false;
    }
    isReplyingRef.current = !!replying;
  }, [replying]);

  const handleUnblockClick = useCallback(() => {
    unblockShip({
      ship: whom,
    });
  }, [unblockShip, whom]);

  const handleDrop = useCallback(
    (fileList: FileList) => {
      const localUploader = useFileStore.getState().getUploader(uploadKey);

      if (
        localUploader &&
        Array.from(fileList).some((f) => PASTEABLE_MEDIA_TYPES.includes(f.type))
      ) {
        localUploader.uploadFiles(fileList);
        useFileStore.getState().setUploadType(uploadKey, 'drag');
        setDroppedFiles((prev) => {
          if (prev) {
            const { [dropZoneId]: _files, ...rest } = prev;
            return rest;
          }
          return prev;
        });

        return true;
      }

      return false;
    },
    [uploadKey, dropZoneId, setDroppedFiles]
  );

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
    chatStoreLogger.log('clearAttachments', { id, uploadKey });
    useChatStore.getState().setBlocks(id, []);
    useFileStore.getState().getUploader(uploadKey)?.clear();
    if (replyCite) {
      closeReply();
    }
  }, [id, uploadKey, closeReply, replyCite]);

  useEffect(() => {
    if (droppedFiles && droppedFiles[dropZoneId]) {
      handleDrop(droppedFiles[dropZoneId]);
      setDidDrop(true);
    }
  }, [droppedFiles, handleDrop, dropZoneId]);

  // update the Attached Items view when files finish uploading and have a size
  useEffect(() => {
    if (
      id &&
      files &&
      Object.values(files).length &&
      !_.some(Object.values(files), (f) => f.size === undefined) &&
      !_.some(Object.values(files), (f) => f.url === '')
    ) {
      const uploadType = useFileStore.getState().getUploadType(uploadKey);

      if (isTargetId && uploadType === 'drag' && didDrop) {
        chatStoreLogger.log('DragUpload', { id, files });
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
        setDidDrop(false);
      }

      if (uploadType !== 'drag') {
        chatStoreLogger.log('Upload', { id, files });
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
    }
  }, [files, id, uploader, isTargetId, uploadKey, didDrop, targetId]);

  const onUpdate = useRef(
    debounce(({ editor }: HandlerParams) => {
      setDraft(editor.getJSON());
    }, 300)
  );

  // ensure we store any drafts before dismounting
  useEffect(
    () => () => {
      onUpdate.current.flush();
    },
    []
  );

  const onSubmit = useCallback(
    async (editor: Editor) => {
      if (
        sendDisabled ||
        mostRecentFile?.status === 'loading' ||
        mostRecentFile?.status === 'error' ||
        mostRecentFile?.url === ''
      )
        return;

      const blocks = fetchChatBlocks(id);
      if (
        !editor.getText() &&
        !blocks.length &&
        !replyCite &&
        chatInfo.blocks.length === 0
      ) {
        return;
      }

      const now = Date.now();

      messageSender({
        whom,
        replying,
        editorJson: editor.isEmpty ? {} : editor.getJSON(),
        text: editor.getText(),
        blocks,
        replyCite,
        now,
        sendDm,
        sendDmReply,
        sendChatMessage,
        sendReply,
      });

      captureGroupsAnalyticsEvent({
        name: reply ? 'comment_item' : 'post_item',
        groupFlag,
        chFlag: whom,
        channelType: 'chat',
        privacy,
      });
      editor?.commands.setContent('');
      onUpdate.current.flush();
      setDraft(inlinesToJSON(['']));
      setTimeout(() => {
        // TODO: chesterton's fence, but why execute a read here?
        useChatStore.getState().read(whom);
        clearAttachments();
      }, 0);
    },
    [
      whom,
      groupFlag,
      privacy,
      id,
      replying,
      setDraft,
      clearAttachments,
      sendDm,
      sendDmReply,
      sendChatMessage,
      sendReply,
      sendDisabled,
      replyCite,
      reply,
      chatInfo.blocks.length,
      mostRecentFile?.status,
      mostRecentFile?.url,
    ]
  );

  const onUpArrow = useCallback(
    ({ editor }: HandlerParams) => {
      if (
        lastMessageIdRef.current &&
        !isEditing &&
        !editor.isDestroyed &&
        editor.isEmpty &&
        // don't allow editing of DM/Group DM messages until we support it
        // on the backend.
        !isDmOrMultiDM
      ) {
        setSearchParams(
          isReplyingRef.current
            ? { editReply: lastMessageIdRef.current }
            : {
                edit: lastMessageIdRef.current,
              },
          { replace: true }
        );
        editor.commands.blur();
        return true;
      }
      return false;
    },
    [isEditing, isDmOrMultiDM, setSearchParams]
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
        onSubmit(editor);
        return true;
      },
      [onSubmit]
    ),
    onUpdate: onUpdate.current,
    onUpArrow,
  });

  useEffect(() => {
    if (
      (autoFocus || replyCite) &&
      !isMobile &&
      messageEditor &&
      !messageEditor.isDestroyed &&
      !isEditing
    ) {
      // end brings the cursor to the end of the content
      messageEditor?.commands.focus('end');
    }
  }, [autoFocus, replyCite, isMobile, messageEditor, isEditing]);

  useEffect(() => {
    if (messageEditor && !messageEditor.isDestroyed && !isEditing) {
      messageEditor?.commands.setContent(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageEditor]);

  useEffect(() => {
    if (replyingWrit && messageEditor && !messageEditor.isDestroyed) {
      messageEditor?.commands.focus();
      const mention = ship ? makeMention(ship.slice(1)) : null;
      const needsMentionInsert =
        mention && !messageEditor.getText().includes(`${ship}:`);
      if (needsMentionInsert) {
        messageEditor?.commands.setContent(mention);
        messageEditor?.commands.insertContent(': ');
      }
      const path =
        replyingWrit[1] && 'memo' in replyingWrit[1]
          ? `/1/chan/chat/${whom}/msg/${threadParentId}/${replyingWrit[0].toString()}`
          : `/1/chan/chat/${whom}/msg/${replyingWrit[0].toString()}`;
      const cite = path ? pathToCite(path) : undefined;
      if (cite && !replyCite) {
        setReplyCite(cite);
      }
    }
  }, [
    replyingWrit,
    threadParentId,
    whom,
    setReplyCite,
    replyCite,
    groupFlag,
    messageEditor,
    ship,
  ]);

  useEffect(() => {
    if (messageEditor && !messageEditor.isDestroyed && isScrolling) {
      messageEditor.commands.blur();
    }
  }, [isScrolling, messageEditor]);

  useEffect(() => {
    if (messageEditor && !messageEditor.isDestroyed) {
      if (!isChatInputFocused && messageEditor.isFocused) {
        handleFocus();
      }

      if (isChatInputFocused && !messageEditor.isFocused) {
        handleBlur();
      }
    }

    return () => {
      if (isChatInputFocused) {
        handleBlur();
      }
    };
  }, [
    isChatInputFocused,
    messageEditor,
    messageEditor?.isFocused,
    handleFocus,
    handleBlur,
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
          if (!id) {
            return;
          }
          setBlocks(id, [{ cite }]);
          chatStoreLogger.log('AndroidPaste', { id, cite });
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
  }, [messageEditor, editorText, editorHTML, id, setBlocks]);

  const onClick = useCallback(
    () => messageEditor && onSubmit(messageEditor),
    [messageEditor, onSubmit]
  );

  const onRemove = useCallback(
    (idx: number) => {
      const blocks = fetchChatBlocks(id);
      if (blocks[idx] && 'image' in blocks[idx]) {
        // @ts-expect-error type check on previous line
        uploader.removeByURL(blocks[idx].image.src);
      }
      chatStoreLogger.log('onRemove', { id, blocks });
      useChatStore.getState().setBlocks(
        id,
        blocks.filter((_b, k) => k !== idx)
      );
    },
    [id, uploader]
  );

  if (isEditing && isMobile) {
    return null;
  }

  // @ts-expect-error tsc is not tracking the type narrowing in the filter
  const imageBlocks: ChatImage[] = chatInfo.blocks.filter((b) => 'image' in b);
  // chatStoreLogger.log('ChatInputRender', id, chatInfo);

  if (shipHasBlockedUs) {
    return (
      <div className="flex w-full items-end space-x-2">
        <div className="flex-1">
          <div className="flex items-center justify-center space-x-2">
            <span>This user has blocked you.</span>
          </div>
        </div>
      </div>
    );
  }

  if (shipIsBlocked) {
    return (
      <div className="flex w-full items-end space-x-2">
        <div className="flex-1">
          <div className="flex items-center justify-center space-x-2">
            <span>You have blocked this user.</span>
            <button className="small-button" onClick={handleUnblockClick}>
              Unblock
            </button>
          </div>
        </div>
      </div>
    );
  }

  // only allow dropping if this component is the target
  if ((isDragging || isOver) && isTargetId) {
    return (
      <div id={dropZoneId} className="flex w-full bg-gray-50">
        <div
          id={dropZoneId}
          className="m-[7px] flex w-full justify-center rounded border-2 border-dashed border-gray-200 bg-gray-50"
        >
          <p id={dropZoneId} className="m-4 text-sm font-bold">
            Drop Attachments Here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex w-full items-end space-x-2', className)}>
      <div
        // sometimes a race condition causes the dropzone to be removed before the drop event fires
        id={dropZoneId}
        className="flex-1"
      >
        {imageBlocks.length > 0 ? (
          <div className="mb-2 flex flex-wrap items-center">
            {imageBlocks.map((img, idx) => {
              const isVideo = VIDEO_REGEX.test(img.image.src);
              const isImage = IMAGE_REGEX.test(img.image.src);

              return (
                <div key={idx} className="relative p-1.5">
                  <button
                    onClick={() => onRemove(idx)}
                    className="icon-button absolute right-4 top-4"
                  >
                    <X16Icon className="h-4 w-4" />
                  </button>
                  {isImage ? (
                    <img
                      title={img.image.alt}
                      src={img.image.src}
                      className="h-32 w-32 object-cover"
                    />
                  ) : isVideo ? (
                    <video
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
              );
            })}
          </div>
        ) : null}

        {chatInfo.blocks.length > 0 ? (
          <div className="mb-4 flex items-center justify-start font-semibold">
            <span className="mr-2 text-gray-600">Attached: </span>
            {chatInfo.blocks.length}{' '}
            {chatInfo.blocks.every((b) => 'image' in b) ? 'file' : 'reference'}
            {chatInfo.blocks.length === 1 ? '' : 's'}
            <button className="icon-button ml-auto" onClick={clearAttachments}>
              <X16Icon className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {showReply && ship && replyingWrit ? (
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
            <Avatar size="xs" ship={window.our} className="mb-1 mr-2" />
          )}
          {messageEditor && (
            <MessageEditor
              editor={messageEditor}
              className={cn(
                'w-full break-words',
                uploader && !uploadError && mostRecentFile?.status !== 'loading'
                  ? 'pr-8'
                  : ''
              )}
            />
          )}
          {uploader && !uploadError && mostRecentFile?.status !== 'loading' ? (
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
        className={cn('button px-2')}
        disabled={
          sendDisabled ||
          mostRecentFile?.status === 'loading' ||
          mostRecentFile?.status === 'error' ||
          mostRecentFile?.url === '' ||
          !messageEditor ||
          (messageEditor?.getText() === '' && chatInfo.blocks.length === 0)
        }
        onMouseDown={(e) => {
          e.preventDefault();
          onClick();
        }}
        aria-label="Send message"
      >
        <ArrowNWIcon16 className="h-4 w-4" />
      </button>
    </div>
  );
}
