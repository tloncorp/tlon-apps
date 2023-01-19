import cn from 'classnames';
import { Editor } from '@tiptap/react';
import React, { useCallback, useEffect } from 'react';
import { DiaryInline } from '@/types/diary';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import { useIsMobile } from '@/logic/useMedia';
import { useDiaryState } from '@/state/diary';
import useRequestState from '@/logic/useRequestState';
import { normalizeInline, JSONToInlines } from '@/logic/tiptap';

interface DiaryCommentFieldProps {
  flag: string;
  replyTo: string;
  className?: string;
  sendDisabled?: boolean;
}

export default function DiaryCommentField({
  flag,
  replyTo,
  className,
  sendDisabled = false,
}: DiaryCommentFieldProps) {
  const isMobile = useIsMobile();
  const { isPending, setPending, setReady } = useRequestState();

  /**
   * This handles submission for new Curios; for edits, see EditCurioForm
   */
  const onSubmit = useCallback(
    async (editor: Editor) => {
      if (sendDisabled) {
        return;
      }
      if (!editor.getText()) {
        return;
      }

      setPending();

      const content = normalizeInline(
        JSONToInlines(editor?.getJSON()) as DiaryInline[]
      );

      editor?.commands.setContent('');
      await useDiaryState.getState().addQuip(flag, replyTo, content);
      setReady();
    },
    [sendDisabled, setPending, replyTo, flag, setReady]
  );

  const messageEditor = useMessageEditor({
    content: '',
    placeholder: 'Add a comment',
    editorClass: 'p-0',
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
      <div className={cn('flex flex-col items-end', className)}>
        <MessageEditor
          editor={messageEditor}
          className="h-full w-full rounded-lg"
          inputClassName={cn(
            'min-h-[104px] p-4 leading-5',
            // Since TipTap simulates an input using a <p> tag, only style
            // the fake placeholder when the field is empty
            messageEditor.getText() === '' ? 'text-gray-400' : ''
          )}
        />
        {!sendDisabled ? (
          <button
            className="button mt-2"
            disabled={isPending || messageEditor.getText() === ''}
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
