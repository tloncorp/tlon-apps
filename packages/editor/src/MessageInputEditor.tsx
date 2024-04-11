import {
  BlockquoteBridge,
  BoldBridge,
  CodeBridge,
  CoreBridge,
  HistoryBridge,
  ItalicBridge,
  LinkBridge,
  StrikeBridge,
  UnderlineBridge,
  useTenTap,
} from '@10play/tentap-editor';
import { Extension, KeyboardShortcutCommand } from '@tiptap/core';
import CodeBlock from '@tiptap/extension-code-block';
import HardBreak from '@tiptap/extension-hard-break';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
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

export const MessageInputEditor = () => {
  const editor = useTenTap({
    bridges: [
      CoreBridge,
      BoldBridge,
      ItalicBridge,
      StrikeBridge,
      BlockquoteBridge,
      HistoryBridge.configureExtension({
        newGroupDelay: 100,
      }),
      CodeBridge.configureExtension({
        HTMLAttributes: {
          class: 'rounded px-1 bg-gray-50 dark:bg-gray-100',
        },
      }),
      UnderlineBridge,
      LinkBridge.configureExtension({
        openOnClick: false,
      }).extendExtension({
        exitable: true,
      }),
    ],
    tiptapOptions: {
      extensions: [
        CodeBlock.configure({
          HTMLAttributes: {
            class: 'mr-4 px-2 rounded bg-gray-50 dark:bg-gray-100',
          },
        }),
        // TODO: Do we need this?
        HardBreak,
        // We use this because the PlaceholderBridge is not working (doesn't render the placeholder text)
        Placeholder.configure({ placeholder: 'Message' }),
        Shortcuts({
          // this is necessary to override the default behavior of the editor
          // which is to insert a new paragraph when the user presses enter.
          // We want enter to send the message instead.
          Enter: () => true,
          // TODO: figure out why shift-enter is not working
          'Shift-Enter': ({ editor }) =>
            editor.commands.first(({ commands }) => [
              () => commands.newlineInCode(),
              () => commands.createParagraphNear(),
              () => commands.liftEmptyBlock(),
              () => commands.splitBlock(),
            ]),
        }),
        Mention.extend({ priority: 1000 }).configure({
          HTMLAttributes: {
            class: 'inline-block rounded bg-blue-soft px-1.5 py-0 text-blue',
          },
          renderLabel: (props) => `~${props.node.attrs.id}`,
        }),
        // TODO: figure out why including this causes the editor to not render
        // Mention.extend({ priority: 999, name: 'at-mention' }).configure({
        // HTMLAttributes: {
        // class: 'inline-block rounded bg-blue-soft px-1.5 py-0 text-blue',
        // },
        // renderLabel: (props) => `~${props.node.attrs.id}`,
        // }),
      ],
    },
  });

  return (
    <EditorContent
      style={{
        flex: 1,
        fontFamily:
          "System, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif",
      }}
      editor={editor}
    />
  );
};
