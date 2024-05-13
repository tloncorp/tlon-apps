import { BridgeExtension } from '@10play/tentap-editor';
import { Extension, KeyboardShortcutCommand } from '@tiptap/core';

type ShortcutsEditorState = {
  canCreateParagraphNear: boolean;
  canNewLineInCode: boolean;
  canLiftEmptyBlock: boolean;
  canSplitBlock: boolean;
};

type ShortcutsEditorInstance = {
  createParagraphNear: () => void;
  newLineInCode: () => void;
  liftEmptyBlock: () => void;
  splitBlock: () => void;
};

declare module '@10play/tentap-editor' {
  interface BridgeState extends ShortcutsEditorState {}
  interface EditorBridge extends ShortcutsEditorInstance {}
}

export enum ShortcutsActionType {
  createParagraphNear = 'create-paragraph-near',
  newLineInCode = 'new-line-in-code',
  liftEmptyBlock = 'toggle-lift-empty-block',
  splitBlock = 'split-block',
}

type ShortcutsMessage = {
  type: ShortcutsActionType;
  payload?: undefined;
};

function Shortcuts(bindings: { [keyCode: string]: KeyboardShortcutCommand }) {
  return Extension.create({
    addKeyboardShortcuts() {
      return bindings;
    },
  });
}

export const ShortcutsBridge = new BridgeExtension<
  ShortcutsEditorState,
  ShortcutsEditorInstance,
  ShortcutsMessage
>({
  //@ts-expect-error version mismatch between tiptap and tentap
  tiptapExtension: Shortcuts({
    // this is necessary to override the default behavior of the editor
    // which is to insert a new paragraph when the user presses enter.
    Enter: () => true,
    'Shift-Enter': () => true,
  }),
  onBridgeMessage: (editor, message) => {
    switch (message.type) {
      // we used all of these actions to create a new paragraph
      // in the tiptap editor on the web.
      // for now it looks likwe we just need splitBlock, but we'll
      // keep the rest of the actions here for reference/possible future use.
      case ShortcutsActionType.createParagraphNear:
        editor.chain().focus().createParagraphNear().run();
        break;
      case ShortcutsActionType.newLineInCode:
        editor.chain().focus().newlineInCode().run();
        break;
      case ShortcutsActionType.liftEmptyBlock:
        editor.chain().focus().liftEmptyBlock().run();
        break;
      case ShortcutsActionType.splitBlock:
        editor.chain().focus().splitBlock().run();
        break;
    }

    return false;
  },
  extendEditorInstance: (sendBridgeMessage) => {
    return {
      createParagraphNear: () =>
        sendBridgeMessage({
          type: ShortcutsActionType.createParagraphNear,
        }),
      newLineInCode: () =>
        sendBridgeMessage({ type: ShortcutsActionType.newLineInCode }),
      liftEmptyBlock: () =>
        sendBridgeMessage({ type: ShortcutsActionType.liftEmptyBlock }),
      splitBlock: () =>
        sendBridgeMessage({ type: ShortcutsActionType.splitBlock }),
    };
  },
  extendEditorState: (editor) => {
    return {
      canCreateParagraphNear: editor.can().createParagraphNear(),
      canNewLineInCode: editor.can().newlineInCode(),
      canLiftEmptyBlock: editor.can().liftEmptyBlock(),
      canSplitBlock: editor.can().splitBlock(),
    };
  },
});
