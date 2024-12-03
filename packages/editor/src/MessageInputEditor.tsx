import {
  BlockquoteBridge,
  BoldBridge,
  BulletListBridge,
  CodeBridge,
  CoreBridge,
  HeadingBridge,
  HistoryBridge,
  ImageBridge,
  ItalicBridge,
  LinkBridge,
  ListItemBridge,
  OrderedListBridge,
  PlaceholderBridge,
  StrikeBridge,
  TaskListBridge,
  useTenTap,
} from '@10play/tentap-editor';
import { Slice } from '@tiptap/pm/model';
import { EditorView } from '@tiptap/pm/view';
import { EditorContent } from '@tiptap/react';
import { useCallback } from 'react';

import { CodeBlockBridge, MentionsBridge, ShortcutsBridge } from './bridges';
import { useIsDark } from './useMedia';

export const MessageInputEditor = () => {
  const handlePaste = useCallback(
    (_view: EditorView, event: ClipboardEvent, _slice: Slice) => {
      const text = event.clipboardData?.getData('text/plain');

      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'paste', payload: text })
      );
    },
    []
  );

  const editor = useTenTap({
    bridges: [
      CoreBridge,
      BoldBridge,
      ItalicBridge,
      HeadingBridge,
      BulletListBridge,
      ListItemBridge,
      OrderedListBridge,
      TaskListBridge,
      ImageBridge,
      StrikeBridge,
      ShortcutsBridge,
      BlockquoteBridge,
      HistoryBridge.configureExtension({
        newGroupDelay: 100,
      }),
      CodeBridge,
      CodeBlockBridge,
      PlaceholderBridge,
      MentionsBridge,
      LinkBridge.configureExtension({
        openOnClick: false,
      }).extendExtension({
        exitable: true,
      }),
    ],
    tiptapOptions: {
      editorProps: {
        handlePaste,
      },
    },
  });

  return (
    <EditorContent
      style={{
        overflow: 'auto',
        height: 'auto',
        fontSize: 16,
        overflowY: 'auto',
        color: useIsDark() ? 'white' : 'black',
        fontFamily:
          "System, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif",
      }}
      editor={editor}
    />
  );
};
