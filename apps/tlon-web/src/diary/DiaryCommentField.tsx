import { Editor } from '@tiptap/react';
import cn from 'classnames';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import {
  fetchChatBlocks,
  useChatInfo,
  useChatStore,
} from '@/chat/useChatStore';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import WritChanReference from '@/components/References/WritChanReference';
import Tooltip from '@/components/Tooltip';
import ArrowNWIcon16 from '@/components/icons/ArrowNIcon16';
import X16Icon from '@/components/icons/X16Icon';
import { useChatInputFocus } from '@/logic/ChatInputFocusContext';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import { useChannelCompatibility } from '@/logic/channel';
import { JSONToInlines, makeMention, normalizeInline } from '@/logic/tiptap';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { useIsMobile } from '@/logic/useMedia';
import useRequestState from '@/logic/useRequestState';
import { pathToCite } from '@/logic/utils';
import { useAddReplyMutation, useReply } from '@/state/channel/channel';
import { Cite, Kind, Story } from '@/types/channel';
import { Inline } from '@/types/content';

interface DiaryCommentFieldProps {
  flag: string;
  han: Kind;
  groupFlag: string;
  replyTo: string;
  className?: string;
  sendDisabled?: boolean;
}

function SubmitLabel({ isHeap }: { isHeap?: boolean }) {
  if (isHeap) {
    return <ArrowNWIcon16 className="h-4 w-4" />;
  }
  return <span>Post</span>;
}

export default function DiaryCommentField({
  flag,
  han,
  groupFlag,
  replyTo,
  className,
  sendDisabled = false,
}: DiaryCommentFieldProps) {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParms] = useSearchParams();
  const [replyCite, setReplyCite] = useState<{ cite: Cite }>();
  const replyId = searchParams.get('replyTo');
  const nest = `${han}/${flag}`;
  const reply = useReply(nest, replyTo, replyId || '');
  const chatInfo = useChatInfo(replyTo);
  const { isPending, setPending, setReady } = useRequestState();
  const { mutateAsync: addReply } = useAddReplyMutation();
  const { privacy } = useGroupPrivacy(groupFlag);
  const { compatible, text } = useChannelCompatibility(nest);
  const { handleFocus, handleBlur, isChatInputFocused } = useChatInputFocus();

  /**
   * This handles submission for new Curios; for edits, see EditCurioForm
   */
  const onSubmit = useCallback(
    async (editor: Editor) => {
      if (sendDisabled) {
        return;
      }

      const blocks = fetchChatBlocks(replyTo);

      if (
        !editor.getText() &&
        !replyCite &&
        blocks.length === 0 &&
        chatInfo.blocks.length === 0
      ) {
        return;
      }

      setPending();

      const inline = normalizeInline(
        JSONToInlines(editor?.getJSON()) as Inline[]
      );

      editor?.commands.setContent('');

      let content: Story = [{ inline }];

      if (replyCite) {
        content = [
          {
            block: replyCite,
          },
          ...content,
        ];
      }

      if (blocks.length > 0) {
        content = [
          ...blocks.map((b) => ({
            block: b,
          })),
          ...content,
        ];
      }

      const now = Date.now();

      await addReply({
        nest,
        postId: replyTo,
        memo: {
          content,
          author: window.our,
          sent: now,
        },
        cacheId: {
          sent: now,
          author: window.our,
        },
      });
      captureGroupsAnalyticsEvent({
        name: 'comment_item',
        groupFlag,
        chFlag: flag,
        channelType: 'diary',
        privacy,
      });
      setReplyCite(undefined);
      setSearchParms();
      useChatStore.getState().setBlocks(replyTo, []);
      setReady();
    },
    [
      sendDisabled,
      setPending,
      replyTo,
      flag,
      nest,
      groupFlag,
      privacy,
      setReady,
      replyCite,
      setReplyCite,
      setSearchParms,
      addReply,
      chatInfo.blocks.length,
    ]
  );

  const clearAttachments = () => {
    setReplyCite(undefined);
    setSearchParms();
  };

  const messageEditor = useMessageEditor({
    whom: replyTo,
    content: '',
    uploadKey: `${han}-comment-field-${flag}`,
    placeholder: 'Add a comment',
    editorClass:
      han === 'heap' ? '!max-h-[108px] overflow-y-auto' : 'p-0 !min-h-[72px]',
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
    if (flag && messageEditor && !messageEditor.isDestroyed) {
      messageEditor?.commands.setContent('');
    }
  }, [flag, messageEditor]);

  useEffect(() => {
    if (reply && replyId && messageEditor && !messageEditor.isDestroyed) {
      messageEditor?.commands.focus();
      const mention = makeMention(reply?.memo.author.slice(1));
      messageEditor?.commands.setContent(mention);
      messageEditor?.commands.insertContent(': ');
      const path = `/1/chan/${han}/${flag}/msg/${replyTo}/${replyId}`;
      const cite = path ? pathToCite(path) : undefined;
      if (cite && !replyCite) {
        setReplyCite({ cite });
      }
    }
  }, [
    replyId,
    replyTo,
    setReplyCite,
    replyCite,
    flag,
    messageEditor,
    reply,
    han,
  ]);

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

  const onClick = useCallback(
    () => messageEditor && onSubmit(messageEditor),
    [messageEditor, onSubmit]
  );

  if (!messageEditor) {
    return null;
  }

  // TODO: Set a sane length limit for comments
  return (
    <div
      className={cn(
        han === 'heap' ? 'items-end' : 'flex flex-col items-end',
        className
      )}
    >
      {replyCite && (
        <div className="mb-2 flex w-full flex-col items-center">
          <div className="mb-4 flex w-full items-center justify-between font-semibold">
            <span className="mr-2 text-gray-600">Replying to:</span>
            <button className="icon-button ml-auto" onClick={clearAttachments}>
              <X16Icon className="h-4 w-4" />
            </button>
          </div>
          <WritChanReference
            nest={nest}
            idWrit={replyTo}
            idReply={replyId || ''}
            isScrolling={false}
          />
        </div>
      )}
      {chatInfo.blocks.length > 0 ? (
        <div className="mb-4 flex items-center justify-start space-x-2 font-semibold">
          <span className="mr-2 text-gray-600">Attached: </span>
          {chatInfo.blocks.length}{' '}
          {chatInfo.blocks.every((b) => 'image' in b) ? 'image' : 'reference'}
          {chatInfo.blocks.length === 1 ? '' : 's'}
          <button className="icon-button ml-auto" onClick={clearAttachments}>
            <X16Icon className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      <div
        className={cn(
          'w-full',
          han === 'heap'
            ? 'flex flex-row items-center'
            : 'relative flex h-full flex-col'
        )}
      >
        <MessageEditor
          editor={messageEditor}
          className={
            han === 'heap' ? 'w-full rounded-lg' : 'h-full w-full rounded-lg'
          }
          inputClassName={cn(
            han === 'heap' ? '' : 'p-4 leading-5',
            // Since TipTap simulates an input using a <p> tag, only style
            // the fake placeholder when the field is empty
            messageEditor.getText() === '' ? 'text-gray-400' : ''
          )}
        />
        {!sendDisabled ? (
          <Tooltip content={text} open={compatible ? false : undefined}>
            <div className="flex flex-row justify-end">
              <button
                className={
                  han === 'heap'
                    ? 'button ml-2 shrink-0 rounded-md px-2 py-1'
                    : 'button mt-2'
                }
                disabled={
                  !compatible ||
                  isPending ||
                  (messageEditor.getText() === '' &&
                    !replyCite &&
                    chatInfo.blocks.length === 0)
                }
                onClick={onClick}
              >
                {isPending ? (
                  <LoadingSpinner secondary="black" />
                ) : (
                  <SubmitLabel isHeap={han === 'heap'} />
                )}
              </button>
            </div>
          </Tooltip>
        ) : null}
      </div>
      {isMobile && messageEditor.isFocused ? (
        <ChatInputMenu editor={messageEditor} />
      ) : null}
    </div>
  );
}
