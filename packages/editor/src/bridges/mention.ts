/* eslint-disable @typescript-eslint/ban-ts-comment -- tiptap 2.x/3.x split */
// @ts-nocheck
// react-native-enriched pulls tiptap 3.x alongside the repo's tiptap 2.x; the
// two @tiptap/core copies make these tentap bridge types fail to check. The
// bridge works at runtime — suppress until the tiptap version split is resolved.
import { BridgeExtension } from '@10play/tentap-editor';
import Mention from '@tiptap/extension-mention';

export const MentionsBridge = new BridgeExtension<
  undefined,
  undefined,
  undefined
>({
  tiptapExtension: Mention.extend({ priority: 1000 }).configure({
    HTMLAttributes: {
      class: 'mention',
    },
    renderLabel: (props) => `~${props.node.attrs.id}`,
  }),
});
