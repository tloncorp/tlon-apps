import cn from 'classnames';
import { Editor } from '@tiptap/react';
import React, { useCallback, useEffect, useState } from 'react';
import { DiaryInline } from '@/types/diary';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import { useIsMobile } from '@/logic/useMedia';
import { useDiaryState, useQuip } from '@/state/diary';
import useRequestState from '@/logic/useRequestState';
import { normalizeInline, JSONToInlines, makeMention } from '@/logic/tiptap';
import { useParams, useSearchParams } from 'react-router-dom';
import X16Icon from '@/components/icons/X16Icon';
import { pathToCite } from '@/logic/utils';
import { Cite } from '@/types/chat';
import NoteCommentReference from '@/components/References/NoteCommentReference';

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
  const [searchParams, setSearchParms] = useSearchParams();
  const [blocks, setBlocks] = useState<{ cite: Cite }[]>([]);
  const quipReplyId = searchParams.get('quip_reply');
  const { chShip, chName } = useParams<{ chShip: string; chName: string }>();
  const chFlag = `${chShip}/${chName}`;
  const quipReply = useQuip(chFlag, replyTo, quipReplyId || '');
  const { isPending, setPending, setReady } = useRequestState();

  /**
   * This handles submission for new Curios; for edits, see EditCurioForm
   */
  const onSubmit = useCallback(
    async (editor: Editor) => {
      if (sendDisabled) {
        return;
      }
      if (!editor.getText() && blocks.length === 0) {
        return;
      }

      setPending();

      const inline = normalizeInline(
        JSONToInlines(editor?.getJSON()) as DiaryInline[]
      );

      editor?.commands.setContent('');
      await useDiaryState
        .getState()
        .addQuip(flag, replyTo, { block: blocks, inline });
      setBlocks([]);
      setSearchParms();
      setReady();
    },
    [
      sendDisabled,
      setPending,
      replyTo,
      flag,
      setReady,
      blocks,
      setBlocks,
      setSearchParms,
    ]
  );

  const clearAttachments = () => {
    setBlocks([]);
    setSearchParms();
  };

  const messageEditor = useMessageEditor({
    whom: replyTo,
    content: '',
    uploadKey: `diary-comment-field-${flag}`,
    placeholder: 'Add a comment',
    editorClass: 'p-0',
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
    if (quipReplyId && messageEditor && !messageEditor.isDestroyed) {
      messageEditor?.commands.focus();
      const mention = makeMention(quipReply?.memo.author.slice(1));
      messageEditor?.commands.setContent(mention);
      messageEditor?.commands.insertContent(': ');
      const path = `/1/chan/diary/${flag}/note/${replyTo}/msg/${quipReplyId}`;
      const cite = path ? pathToCite(path) : undefined;
      if (cite && blocks.length === 0) {
        setBlocks([{ cite }]);
      }
    }
  }, [quipReplyId, replyTo, setBlocks, blocks, flag, messageEditor, quipReply]);

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
        {blocks.length > 0 && (
          <div className="mb-2 flex w-full flex-col items-center">
            <div className="mb-4 flex w-full items-center justify-between font-semibold">
              <span className="mr-2 text-gray-600">Replying to:</span>
              <button
                className="icon-button ml-auto"
                onClick={clearAttachments}
              >
                <X16Icon className="h-4 w-4" />
              </button>
            </div>
            <NoteCommentReference
              chFlag={chFlag}
              nest={`diary/${chFlag}`}
              noteId={replyTo}
              quipId={quipReplyId || ''}
            />
          </div>
        )}
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
            disabled={
              isPending ||
              (messageEditor.getText() === '' && blocks.length === 0)
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
