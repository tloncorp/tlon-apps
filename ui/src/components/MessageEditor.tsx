import { Editor, EditorContent, Extension, useEditor } from '@tiptap/react';
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
import Paragraph from '@tiptap/extension-paragraph';
import HardBreak from '@tiptap/extension-hard-break';

interface HandlerParams {
  editor: Editor;
}

interface useMessageEditorParams {
  placeholder?: string;
  onEnter: ({ editor }: HandlerParams) => boolean;
}

export function useMessageEditor({
  placeholder,
  onEnter,
}: useMessageEditorParams) {
  const keyMapExt = useMemo(
    () =>
      Extension.create({
        priority: 999999,
        addKeyboardShortcuts() {
          return {
            Enter: ({ editor }) => onEnter({ editor } as any),
            'Shift-Enter': ({ editor }) =>
              editor.commands.first(({ commands }) => [
                () => commands.newlineInCode(),
                () => commands.createParagraphNear(),
                () => commands.liftEmptyBlock(),
                () => commands.splitBlock(),
              ]),
          };
        },
      }),
    [onEnter]
  );

  return useEditor({
    extensions: [
      Blockquote,
      Bold,
      Code,
      Document,
      HardBreak,
      Italic,
      Link,
      keyMapExt,
      Paragraph,
      Placeholder.configure({ placeholder }),
      Strike,
      Text,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'input block',
        'aria-label': 'Message editor with formatting menu',
      },
    },
  });
}

interface MessageEditorProps {
  editor: Editor;
}

export default function MessageEditor({ editor }: MessageEditorProps) {
  return <EditorContent className="w-full" editor={editor} />;
}
