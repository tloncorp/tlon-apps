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
    // The id is a ship name, which is never shown. The app sets the label to a
    // nickname or ship number when it loads content into the editor.
    renderLabel: (props) => props.node.attrs.label ?? '@',
  }),
});
