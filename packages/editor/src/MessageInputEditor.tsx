import {
  BlockquoteBridge,
  BoldBridge,
  CodeBridge,
  CoreBridge,
  HistoryBridge,
  ItalicBridge,
  LinkBridge,
  PlaceholderBridge,
  StrikeBridge,
  UnderlineBridge,
  useTenTap,
} from '@10play/tentap-editor';
import { Extension, KeyboardShortcutCommand } from '@tiptap/core';
import CodeBlock from '@tiptap/extension-code-block';
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
      CodeBridge,
      UnderlineBridge,
      PlaceholderBridge.configureExtension({
        placeholder: 'Message',
      }),
      LinkBridge.configureExtension({
        openOnClick: false,
      }).extendExtension({
        exitable: true,
      }),
    ],
    tiptapOptions: {
      extensions: [
        CodeBlock,
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
