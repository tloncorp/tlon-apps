import { CoreBridge, useTenTap } from '@10play/tentap-editor';
import { Extension, KeyboardShortcutCommand } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Strike from '@tiptap/extension-strike';
import Text from '@tiptap/extension-text';
import { EditorContent } from '@tiptap/react';

export function Shortcuts(bindings: {
  [keyCode: string]: KeyboardShortcutCommand;
}) {
  return Extension.create({
    addKeyboardShortcuts() {
      return bindings;
    },
  });
}

/**
 * Here we control the web side of our custom editor
 */
export const AdvancedEditor = () => {
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
    Link.configure({
      openOnClick: false,
    }).extend({
      exitable: true,
    }),
    Paragraph,
    Placeholder.configure({ placeholder: 'Message' }),
    Strike,
    Text,
    Shortcuts({
      // this is necessary to override the default behavior of the editor
      // which is to insert a new paragraph when the user presses enter.
      // We want enter to send the message instead.
      Enter: () => true,
    }),
    Mention.extend({ priority: 1000 }).configure({
      HTMLAttributes: {
        class: 'inline-block rounded bg-blue-soft px-1.5 py-0 text-blue',
      },
      renderLabel: (props) => `~${props.node.attrs.id}`,
    }),
    // Mention.extend({ priority: 999, name: 'at-mention' }).configure({
      // HTMLAttributes: {
        // class: 'inline-block rounded bg-blue-soft px-1.5 py-0 text-blue',
      // },
      // renderLabel: (props) => `~${props.node.attrs.id}`,
    // }),
  ];

  const editor = useTenTap({
    bridges: [CoreBridge],
    tiptapOptions: {
      extensions,
    },
  });
  return (
    <EditorContent
      style={{
        fontFamily:
          "System, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif",
      }}
      editor={editor}
    />
  );
};
