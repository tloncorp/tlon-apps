/* eslint-disable @typescript-eslint/ban-ts-comment -- tiptap 2.x/3.x split */
// @ts-nocheck
// react-native-enriched pulls tiptap 3.x alongside the repo's tiptap 2.x; the
// two @tiptap/core copies make these tentap bridge types fail to check. The
// bridge works at runtime — suppress until the tiptap version split is resolved.
import { BridgeExtension } from '@10play/tentap-editor';
import HorizontalRule from '@tiptap/extension-horizontal-rule';

type HorizontalRuleEditorState = {
  canSetHorizontalRule: boolean;
};

type HorizontalRuleEditorInstance = {
  setHorizontalRule: () => void;
};

declare module '@10play/tentap-editor' {
  interface BridgeState extends HorizontalRuleEditorState {}
  interface EditorBridge extends HorizontalRuleEditorInstance {}
}

export enum HorizontalRuleEditorActionType {
  SetHorizontalRule = 'set-horizontal-rule',
}

type HorizontalRuleMessage = {
  type: HorizontalRuleEditorActionType.SetHorizontalRule;
  payload?: undefined;
};

export const HorizontalRuleBridge = new BridgeExtension<
  HorizontalRuleEditorState,
  HorizontalRuleEditorInstance,
  HorizontalRuleMessage
>({
  tiptapExtension: HorizontalRule.configure({
    HTMLAttributes: {
      class: 'horizontal-rule',
    },
  }),
  onBridgeMessage: (editor, message) => {
    if (message.type === HorizontalRuleEditorActionType.SetHorizontalRule) {
      editor.chain().focus().setHorizontalRule().run();
    }

    return false;
  },
  extendEditorInstance: (sendBridgeMessage) => {
    return {
      setHorizontalRule: () =>
        sendBridgeMessage({
          type: HorizontalRuleEditorActionType.SetHorizontalRule,
        }),
    };
  },
  extendEditorState: (editor) => {
    return {
      canSetHorizontalRule: editor.can().setHorizontalRule(),
    };
  },
  extendCSS: `
    hr {
      border: none;
      border-top: 1px solid #ccc;
      margin: 1em 0;
    }
  `,
});
