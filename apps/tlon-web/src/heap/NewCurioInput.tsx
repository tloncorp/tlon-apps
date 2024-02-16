import Blockquote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Strike from '@tiptap/extension-strike';
import Text from '@tiptap/extension-text';
import { Slice } from '@tiptap/pm/model';
import { EditorView } from '@tiptap/pm/view';
import { Editor, EditorContent, JSONContent, useEditor } from '@tiptap/react';
import { useCallback, useMemo } from 'react';

import { Shortcuts } from '@/logic/tiptap';
import { useCalm } from '@/state/settings';

interface NewCurioInput {
  placeholder: string;
  onChange: (editorUpdate: EditorUpdate) => void;
  onPastedFiles: (files: FileList) => void;
}

export interface EditorUpdate {
  json: JSONContent;
  text: string;
}

export default function NewCurioInput({
  placeholder,
  onPastedFiles,
  onChange,
}: NewCurioInput) {
  const calm = useCalm();

  const onUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      onChange({ json: editor.getJSON(), text: editor.getText() });
    },
    [onChange]
  );

  const handlePaste = useCallback(
    (_view: EditorView, event: ClipboardEvent, _slice: Slice) => {
      if (event.clipboardData && event.clipboardData.files) {
        onPastedFiles(event.clipboardData.files);
        return false;
      }

      return true;
    },
    [onPastedFiles]
  );

  const keyMapExt = useMemo(
    () =>
      Shortcuts({
        'Shift-Enter': ({ editor }) =>
          editor.commands.first(({ commands }) => [
            () => commands.newlineInCode(),
            () => commands.createParagraphNear(),
            () => commands.liftEmptyBlock(),
            () => commands.splitBlock(),
          ]),
      }),
    []
  );

  const extensions = [
    Blockquote,
    Bold,
    Code.extend({
      excludes: undefined,
      exitable: true,
    }).configure({
      HTMLAttributes: {
        class: 'rounded px-1 bg-gray-50 dark:bg-gray-100',
      },
    }),
    CodeBlock.configure({
      HTMLAttributes: {
        class: 'mr-4 px-2 rounded bg-gray-50 dark:bg-gray-100',
      },
    }),
    Document,
    HardBreak,
    History.configure({ newGroupDelay: 100 }),
    Italic,
    keyMapExt,
    Link.configure({
      openOnClick: false,
    }).extend({
      exitable: true,
    }),
    Paragraph,
    Placeholder.configure({ placeholder }),
    Strike,
    Text,
  ];

  const editor = useEditor(
    {
      extensions,
      content: '',
      editorProps: {
        attributes: {
          'aria-label': 'Gallery block editor',
          spellcheck: `${!calm.disableSpellcheck}`,
        },
        handlePaste,
      },
      onUpdate: ({ editor: ed }) => {
        if (onUpdate) {
          onUpdate({ editor: ed } as { editor: Editor });
        }
      },
      onCreate: ({ editor: ed }) => {
        ed.chain().focus().run();
      },
    },
    [keyMapExt]
  );

  if (!editor) {
    return null;
  }

  return (
    <EditorContent
      className="new-curio-input align-center flex max-h-[350px] w-full overflow-scroll rounded-lg bg-gray-50 p-4 pb-0 leading-5"
      editor={editor}
    />
  );
}
