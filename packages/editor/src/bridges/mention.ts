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
