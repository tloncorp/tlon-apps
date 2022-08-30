import { Editor, JSONContent } from '@tiptap/react';
import React, { useCallback, useEffect } from 'react';
import { HeapInline, CurioHeart, LIST, EditCurioFormSchema, NewCurioFormSchema } from '@/types/heap';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import { useIsMobile } from '@/logic/useMedia';
import { useHeapDisplayMode, useHeapState } from '@/state/heap/heap';
import classNames from 'classnames';
import useRequestState from '@/logic/useRequestState';
import { normalizeInline, parseTipTapJSON } from '@/logic/tiptap';
import useCurioFromParams from './useCurioFromParams';
import { SubmitHandler } from 'react-hook-form';

interface HeapTextInputProps {
  flag: string;
  sendDisabled?: boolean;
  draft: JSONContent | undefined;
  setDraft: React.Dispatch<React.SetStateAction<JSONContent | undefined>>;
  replyTo?: string | null;
  title?: string | null;
  isEditing?: boolean;
  submissible?: boolean;
  providedOnSubmit?: SubmitHandler<NewCurioFormSchema> | SubmitHandler<EditCurioFormSchema>;
}

export default function HeapTextInput({
  flag,
  sendDisabled = false,
  replyTo = null,
  draft,
  setDraft,
  title = null,
  isEditing = false,
  submissible = false,
  providedOnSubmit,
}: HeapTextInputProps) {
  const displayMode = useHeapDisplayMode(flag);
  const isMobile = useIsMobile();
  const { isPending, setPending, setReady } = useRequestState();
  const { time } = useCurioFromParams();

  const onSubmit = useCallback(
    async (editor: Editor) => {
      if (!editor.getText()) {
        return;
      }

      setPending();

      const content = normalizeInline(
        parseTipTapJSON(editor?.getJSON())
      ) as HeapInline[];

      const heart: CurioHeart = {
        title: isEditing ? title : null,
        replying: replyTo,
        author: window.our,
        sent: Date.now(),
        content,
      };

      if(isEditing) {
        if(!time) { return; }
        await useHeapState.getState().editCurio(flag, time.toString(), heart);
      } else {
        await useHeapState.getState().addCurio(flag, heart);
      }

      setDraft(undefined);
      editor?.commands.setContent('');
      setReady();
    },
    [setPending, isEditing, title, replyTo, setDraft, setReady, time, flag]
  );

  const onUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      setDraft(editor.getJSON());
    },
    [setDraft]
  );

  const messageEditor = useMessageEditor({
    content: draft || '',
    placeholder: 'Enter Text Here',
    onUpdate,
    onEnter: useCallback(
      ({ editor }) => {
        if(providedOnSubmit) {
          providedOnSubmit({ content: draft, title });
        } else
        {
          onSubmit(editor);
        }
        return true;
      },
      [onSubmit, providedOnSubmit]
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
    () => {
      if(providedOnSubmit) {
        providedOnSubmit();
      } else if (messageEditor)
      {
        onSubmit(messageEditor);
      }
    }, [messageEditor, onSubmit, providedOnSubmit]);

  if (!messageEditor) {
    return null;
  }

  // TODO: Set a sane length limit for comments
  return (
    <>
      <div className="relative flex-1 p-1">
        <MessageEditor
          editor={messageEditor}
          className="h-full w-full rounded-lg"
          inputClassName={classNames(
            // Since TipTap simulates an input using a <p> tag, only style
            // the fake placeholder when the field is empty
            messageEditor.getText() === '' ? 'font-semibold text-gray-400' : '',
            displayMode === LIST ? 'min-h-[44px]' : ''
          )}
        />
        {
          submissible ? <button
            className="button absolute bottom-3 right-3 rounded-md px-2 py-1"
            disabled={sendDisabled || isPending || messageEditor.getText() === ''}
            onClick={onClick}
          >
            {isPending ? 'Posting...' : 'Post'}
          </button> : null
        }
      </div>
      {isMobile && messageEditor.isFocused ? (
        <ChatInputMenu editor={messageEditor} />
      ) : null}
    </>
  );
}
