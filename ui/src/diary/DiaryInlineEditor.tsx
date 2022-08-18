import classNames from 'classnames';
import { EditorView } from 'prosemirror-view';
import { Editor as EditorCore } from '@tiptap/core';
import {
  Editor,
  EditorContent,
  Extension,
  JSONContent,
  useEditor,
} from '@tiptap/react';
import React, { useEffect, useMemo } from 'react';
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

interface useDiaryInlineEditorParams {
  content: JSONContent | string;
  placeholder?: string;
  onUpdate?: ({ editor }: HandlerParams) => void;
  onBlur?: ({ editor }: HandlerParams) => void;
}

export function useDiaryInlineEditor({
  content,
  placeholder,
  onUpdate,
  onBlur,
}: useDiaryInlineEditorParams) {
  const ed = useEditor(
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
          class: 'input-transparent',
          'aria-label': 'Note editor with formatting menu',
        },
      },
      onBlur: ({ editor }) => {
        if (onBlur) {
          onBlur({ editor } as any);
        }
      },
      onUpdate: ({ editor }) => {
        if (onUpdate) {
          onUpdate({ editor } as any);
        }
      },
    },
    [placeholder, onBlur]
  );

  useEffect(() => {
    if (ed && !ed.isDestroyed) {
      ed.chain().clearContent().insertContent(content).focus().run();
    }
  }, [ed, content]);

  return ed;
}

interface DiaryInlineEditorProps {
  editor: Editor;
  className?: string;
}

export default function DiaryInlineEditor({
  editor,
  className,
}: DiaryInlineEditorProps) {
  const isMobile = useIsMobile();
  return (
    <div className={classNames('input-transparent block p-0', className)}>
      {/* This is nested in a div so that the bubble  menu is keyboard accessible */}
      <EditorContent className="w-full" editor={editor} />
      {!isMobile ? <ChatInputMenu editor={editor} /> : null}
    </div>
  );
}
