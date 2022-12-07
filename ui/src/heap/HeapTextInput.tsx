import cn from 'classnames';
import { Editor, JSONContent } from '@tiptap/react';
import React, { useCallback, useEffect } from 'react';
import { HeapInline, CurioHeart, HeapInlineKey, LIST } from '@/types/heap';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import { useIsMobile } from '@/logic/useMedia';
import { useHeapState } from '@/state/heap/heap';
import { reduce } from 'lodash';
import useRequestState from '@/logic/useRequestState';
import { JSONToInlines } from '@/logic/tiptap';
import {
  fetchChatBlocks,
  useChatInfo,
  useChatStore,
} from '@/chat/useChatStore';
import X16Icon from '@/components/icons/X16Icon';

interface HeapTextInputProps {
  flag: string;
  draft: JSONContent | undefined;
  setDraft: React.Dispatch<React.SetStateAction<JSONContent | undefined>>;
  placeholder?: string;
  sendDisabled?: boolean;
  replyTo?: string | null;
  className?: string;
  inputClass?: string;
}

const MERGEABLE_KEYS = ['italics', 'bold', 'strike', 'blockquote'] as const;
function isMergeable(x: HeapInlineKey): x is typeof MERGEABLE_KEYS[number] {
  return MERGEABLE_KEYS.includes(x as any);
}
function normalizeHeapInline(inline: HeapInline[]): HeapInline[] {
  return reduce(
    inline,
    (acc: HeapInline[], val) => {
      if (acc.length === 0) {
        return [...acc, val];
      }
      const last = acc[acc.length - 1];
      if (typeof last === 'string' && typeof val === 'string') {
        return [...acc.slice(0, -1), last + val];
      }
      const lastKey = Object.keys(acc[acc.length - 1])[0] as HeapInlineKey;
      const currKey = Object.keys(val)[0] as keyof HeapInlineKey;
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
  draft,
  setDraft,
  replyTo = null,
  sendDisabled = false,
  placeholder,
  className,
  inputClass,
}: HeapTextInputProps) {
  const isMobile = useIsMobile();
  const { isPending, setPending, setReady } = useRequestState();
  const chatInfo = useChatInfo(flag);

  /**
   * This handles submission for new Curios; for edits, see EditCurioForm
   */
  const onSubmit = useCallback(
    async (editor: Editor) => {
      if (sendDisabled) {
        return;
      }
      const blocks = fetchChatBlocks(flag);
      if (!editor.getText() && !blocks.length) {
        return;
      }

      setPending();

      const content = {
        inline:
          blocks.length === 0
            ? normalizeHeapInline(
                JSONToInlines(editor?.getJSON()) as HeapInline[]
              )
            : [],
        block: blocks,
      };

      const heart: CurioHeart = {
        title: '', // TODO: Title input
        replying: replyTo,
        author: window.our,
        sent: Date.now(),
        content,
      };

      await useHeapState.getState().addCurio(flag, heart);
      setDraft(undefined);
      editor?.commands.setContent('');
      useChatStore.getState().setBlocks(flag, []);
      setReady();
    },
    [sendDisabled, setPending, replyTo, flag, setDraft, setReady]
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
    placeholder: placeholder || 'Enter Text Here',
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

  const onClick = useCallback(
    () => messageEditor && onSubmit(messageEditor),
    [messageEditor, onSubmit]
  );

  if (!messageEditor) {
    return null;
  }

  // TODO: Set a sane length limit for comments
  return (
    <>
      <div
        className={cn('relative', className)}
        onClick={() => messageEditor.commands.focus()}
      >
        {chatInfo.blocks.length > 0 ? (
          <div className="my-2 flex items-center justify-start font-semibold">
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
        <MessageEditor
          editor={messageEditor}
          className={cn('h-full w-full rounded-lg', inputClass)}
          inputClassName={cn(
            // Since TipTap simulates an input using a <p> tag, only style
            // the fake placeholder when the field is empty
            messageEditor.getText() === '' ? 'font-semibold text-gray-400' : ''
          )}
        />
        {!sendDisabled ? (
          <button
            className="button absolute bottom-3 right-3 rounded-md px-2 py-1"
            disabled={
              sendDisabled ||
              isPending ||
              (messageEditor.getText() === '' && chatInfo.blocks.length === 0)
            }
            onClick={onClick}
          >
            {isPending ? 'Posting...' : 'Post'}
          </button>
        ) : null}
      </div>
      {isMobile && messageEditor.isFocused ? (
        <ChatInputMenu editor={messageEditor} />
      ) : null}
    </>
  );
}
