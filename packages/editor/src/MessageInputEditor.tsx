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
import CodeBlock from '@tiptap/extension-code-block';
import { EditorContent } from '@tiptap/react';

import { ShortcutsBridge } from './bridges/shortcut';
import { useIsDark } from './useMedia';

export const MessageInputEditor = () => {
  const editor = useTenTap({
    bridges: [
      CoreBridge,
      BoldBridge,
      ItalicBridge,
      StrikeBridge,
      ShortcutsBridge,
      BlockquoteBridge,
      HistoryBridge.configureExtension({
        newGroupDelay: 100,
      }),
      CodeBridge,
      UnderlineBridge,
      PlaceholderBridge,
      LinkBridge.configureExtension({
        openOnClick: false,
      }).extendExtension({
        exitable: true,
      }),
    ],
    tiptapOptions: {
      extensions: [CodeBlock],
    },
  });

  return (
    <EditorContent
      style={{
        overflow: 'auto',
        height: 'auto',
        // making this explicit
        fontSize: 16,
        color: useIsDark() ? 'white' : 'black',
        fontFamily:
          "System, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif",
      }}
      // @ts-expect-error bad
      editor={editor}
    />
  );
};
