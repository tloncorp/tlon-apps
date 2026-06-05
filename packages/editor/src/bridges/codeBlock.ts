// @ts-nocheck
// react-native-enriched pulls tiptap 3.x alongside the repo's tiptap 2.x; the
// two @tiptap/core copies make these tentap bridge types fail to check. The
// bridge works at runtime — suppress until the tiptap version split is resolved.
import { BridgeExtension } from '@10play/tentap-editor';
import CodeBlock from '@tiptap/extension-code-block';

type CodeBlockEditorState = {
  isCodeBlockActive: boolean;
  canToggleCodeBlock: boolean;
};

type CodeBlockEditorInstance = {
  toggleCodeBlock: () => void;
  setCodeBlock: () => void;
};

declare module '@10play/tentap-editor' {
  interface BridgeState extends CodeBlockEditorState {}
  interface EditorBridge extends CodeBlockEditorInstance {}
}

export enum CodeBlockEditorActionType {
  ToggleCodeBlock = 'toggle-code-block',
  SetCodeBlock = 'set-code-block',
}

type CodeBlockMessage = {
  type:
    | CodeBlockEditorActionType.ToggleCodeBlock
    | CodeBlockEditorActionType.SetCodeBlock;
  payload?: undefined;
};

export const CodeBlockBridge = new BridgeExtension<
  CodeBlockEditorState,
  CodeBlockEditorInstance,
  CodeBlockMessage
>({
  tiptapExtension: CodeBlock.configure({
    HTMLAttributes: {
      class: 'code-block',
    },
  }),
  onBridgeMessage: (editor, message) => {
    if (message.type === CodeBlockEditorActionType.ToggleCodeBlock) {
      editor.chain().focus().toggleCodeBlock().run();
    }

    if (message.type === CodeBlockEditorActionType.SetCodeBlock) {
      editor.chain().focus().setCodeBlock().run();
    }

    return false;
  },
  extendEditorInstance: (sendBridgeMessage) => {
    return {
      toggleCodeBlock: () =>
        sendBridgeMessage({ type: CodeBlockEditorActionType.ToggleCodeBlock }),
      setCodeBlock: () => {
        sendBridgeMessage({ type: CodeBlockEditorActionType.SetCodeBlock });
      },
    };
  },
  extendEditorState: (editor) => {
    return {
      canToggleCodeBlock: editor.can().toggleCodeBlock(),
      isCodeBlockActive: editor.isActive('codeBlock'),
    };
  },
  extendCSS: `
    code {
        background-color: transparent;
        border-radius: 0px;
        box-decoration-break: slice;
        webkit-box-decoration-break: slice;
        color: #616161;
        font-size: 0.9rem;
        padding: 0px;
    }
  `,
});
