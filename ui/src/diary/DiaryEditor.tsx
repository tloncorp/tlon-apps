import classNames from 'classnames';
import { EditorView } from 'prosemirror-view';
import {
  Editor,
  EditorContent,
  Extension,
  JSONContent,
  useEditor,
} from '@tiptap/react';
import React, { useMemo } from 'react';
import Document from '@tiptap/extension-document';
import Blockquote from '@tiptap/extension-blockquote';
import Placeholder from '@tiptap/extension-placeholder';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import Link from '@tiptap/extension-link';
import Text from '@tiptap/extension-text';
import History from '@tiptap/extension-history';
import Paragraph from '@tiptap/extension-paragraph';
import HardBreak from '@tiptap/extension-hard-break';
import { useIsMobile } from '@/logic/useMedia';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';

EditorView.prototype.updateState = function updateState(state) {
  if (!(this as any).docView) return; // This prevents the matchesNode error on hot reloads
  (this as any).updateStateInner(state, this.state.plugins != state.plugins); //eslint-disable-line
};

interface HandlerParams {
  editor: Editor;
}

interface useDiaryEditorParams {
  content: JSONContent | string;
  placeholder?: string;
  onUpdate?: ({ editor }: HandlerParams) => void;
}

export function useDiaryEditor({
  content,
  placeholder,
  onUpdate,
}: useDiaryEditorParams) {
  return useEditor(
    {
      extensions: [
        Blockquote,
        Bold,
        Code,
        Document,
        HardBreak,
        History.configure({ newGroupDelay: 100 }),
        Italic,
        Link.configure({
          openOnClick: false,
        }),
        Paragraph,
        Placeholder.configure({ placeholder }),
        Strike,
        Text,
      ],
      content: content || '',
      editorProps: {
        attributes: {
          class: '',
          'aria-label': 'Note editor with formatting menu',
        },
      },
      onUpdate: ({ editor }) => {
        if (onUpdate) {
          onUpdate({ editor } as any);
        }
      },
    },
    [placeholder]
  );
}

interface DiaryEditorProps {
  editor: Editor;
  className?: string;
}

export default function DiaryEditor({ editor, className }: DiaryEditorProps) {
  const isMobile = useIsMobile();
  return (
    <div className={classNames('input-transparent block p-0', className)}>
      {/* This is nested in a div so that the bubble  menu is keyboard accessible */}
      <EditorContent className="w-full" editor={editor} />
      {!isMobile ? <ChatInputMenu editor={editor} /> : null}
    </div>
  );
}
