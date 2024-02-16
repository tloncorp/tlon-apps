import { Editor, JSONContent } from '@tiptap/react';
import cn from 'classnames';
import { reduce } from 'lodash';
import React, { useCallback, useEffect } from 'react';

import {
  fetchChatBlocks,
  useChatInfo,
  useChatStore,
} from '@/chat/useChatStore';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import Tooltip from '@/components/Tooltip';
import ArrowNIcon16 from '@/components/icons/ArrowNIcon16';
import X16Icon from '@/components/icons/X16Icon';
import { useChatInputFocus } from '@/logic/ChatInputFocusContext';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import { useChannelCompatibility } from '@/logic/channel';
import { JSONToInlines } from '@/logic/tiptap';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { useIsMobile } from '@/logic/useMedia';
import useRequestState from '@/logic/useRequestState';
import {
  useAddPostMutation,
  useAddReplyMutation,
} from '@/state/channel/channel';
import { PostEssay, constructStory } from '@/types/channel';
import { Inline, InlineKey } from '@/types/content';

interface HeapTextInputProps {
  flag: string;
  groupFlag: string;
  draft: JSONContent | undefined;
  setDraft: React.Dispatch<React.SetStateAction<JSONContent | undefined>>;
  placeholder?: string;
  sendDisabled?: boolean;
  replyTo?: string | null;
  className?: string;
  inputClass?: string;
}

const MERGEABLE_KEYS = ['italics', 'bold', 'strike', 'blockquote'] as const;
function isMergeable(x: InlineKey): x is (typeof MERGEABLE_KEYS)[number] {
  return MERGEABLE_KEYS.includes(x as any);
}
function normalizeHeapInline(inline: Inline[]): Inline[] {
  return reduce(
    inline,
    (acc: Inline[], val) => {
      if (acc.length === 0) {
        return [...acc, val];
      }
      const last = acc[acc.length - 1];
      if (typeof last === 'string' && typeof val === 'string') {
        return [...acc.slice(0, -1), last + val];
      }
      const lastKey = Object.keys(acc[acc.length - 1])[0] as InlineKey;
      const currKey = Object.keys(val)[0] as keyof InlineKey;
      if (isMergeable(lastKey) && currKey === lastKey) {
        // @ts-expect-error keying weirdness
        const end: HeapInline = {
          // @ts-expect-error keying weirdness
          [lastKey]: [...last[lastKey as any], ...val[currKey as any]],
        };
        return [...acc.slice(0, -1), end];
      }
      return [...acc, val];
    },
    []
  );
}

export default function HeapTextInput({
  flag,
  groupFlag,
  draft,
  setDraft,
  replyTo = null,
  sendDisabled = false,
  placeholder,
  className,
  inputClass,
}: HeapTextInputProps) {
  const nest = `heap/${flag}`;
  const isMobile = useIsMobile();
  const { isPending, setPending, setReady } = useRequestState();
  const chatInfo = useChatInfo(flag);
  const { privacy } = useGroupPrivacy(groupFlag);
  const { compatible, text } = useChannelCompatibility(nest);
  const { mutate } = useAddPostMutation(nest);
  const { mutate: addReply } = useAddReplyMutation();
  const { handleFocus, handleBlur, isChatInputFocused } = useChatInputFocus();

  /**
   * This handles submission for new Curios; for edits, see EditCurioForm
   */
  const onSubmit = useCallback(
    async (editor: Editor) => {
      if (sendDisabled) {
        return;
      }
      const now = Date.now();
      const cacheId = {
        sent: now,
        author: window.our,
      };
      const blocks = fetchChatBlocks(flag);
      if (!editor.getText() && !blocks.length) {
        return;
      }

      setPending();

      const data = JSONToInlines(editor?.getJSON());
      const content = constructStory(data);

      const heart: PostEssay = {
        'kind-data': {
          heap: '', // TODO: Title input
        },
        author: window.our,
        sent: now,
        content,
      };

      setDraft(undefined);
      editor?.commands.setContent('');
      useChatStore.getState().setBlocks(flag, []);

      if (replyTo) {
        addReply(
          {
            nest: `heap/${flag}`,
            postId: replyTo,
            memo: {
              content,
              sent: now,
              author: window.our,
            },
            cacheId,
          },
          {
            onSuccess: () => {
              captureGroupsAnalyticsEvent({
                name: 'post_item',
                groupFlag,
                chFlag: flag,
                channelType: 'heap',
                privacy,
              });
              setReady();
            },
          }
        );
        return;
      }

      mutate(
        { essay: heart, cacheId },
        {
          onSuccess: () => {
            captureGroupsAnalyticsEvent({
              name: 'post_item',
              groupFlag,
              chFlag: flag,
              channelType: 'heap',
              privacy,
            });
          },
          onSettled: () => {
            setReady();
          },
        }
      );
    },
    [
      sendDisabled,
      setPending,
      flag,
      groupFlag,
      privacy,
      setDraft,
      setReady,
      mutate,
      addReply,
      replyTo,
    ]
  );

  const onUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      setDraft(editor.getJSON());
    },
    [setDraft]
  );

  const messageEditor = useMessageEditor({
    whom: flag,
    content: draft || '',
    uploadKey: `heap-text-input-${flag}`,
    placeholder: placeholder || 'Enter Text Here',
    editorClass: '!max-h-[108px] overflow-y-auto',
    onUpdate,
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
    if (draft && messageEditor && !messageEditor.isDestroyed) {
      messageEditor.commands.setContent(draft);
    }
    // only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageEditor]);

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
      className={cn('items-end', className)}
      onClick={() => messageEditor.commands.focus()}
    >
      {chatInfo.blocks.length > 0 ? (
        <div className="my-2 flex w-full items-center justify-start font-semibold">
          <span className="mr-2 text-gray-600">Attached: </span>
          {chatInfo.blocks.length} reference
          {chatInfo.blocks.length === 1 ? '' : 's'}
          <button
            className="icon-button ml-auto"
            onClick={() => useChatStore.getState().setBlocks(flag, [])}
          >
            <X16Icon className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      <div className={cn('w-full', 'relative flex h-full')}>
        <MessageEditor
          editor={messageEditor}
          className={cn('w-full rounded-lg', inputClass)}
          inputClassName={cn(
            // Since TipTap simulates an input using a <p> tag, only style
            // the fake placeholder when the field is empty
            messageEditor.getText() === '' ? 'text-gray-400' : ''
          )}
        />
        {!sendDisabled ? (
          <Tooltip content={text} open={compatible ? false : undefined}>
            <button
              className={cn(
                'button rounded-md px-2 py-1',
                'absolute bottom-3 right-3'
              )}
              disabled={
                isPending ||
                !compatible ||
                (messageEditor.getText() === '' && chatInfo.blocks.length === 0)
              }
              onClick={onClick}
            >
              {isPending ? (
                <LoadingSpinner secondary="black" />
              ) : (
                <span>Post</span>
              )}
            </button>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
