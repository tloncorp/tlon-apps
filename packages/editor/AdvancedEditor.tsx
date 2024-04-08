import { CoreBridge, useTenTap } from '@10play/tentap-editor';
import { EditorContent } from '@tiptap/react';
import { extensions } from '@tloncorp/shared/dist/tiptap';
import React from 'react';

/**
 * Here we control the web side of our custom editor
 */
export const AdvancedEditor = () => {
  const editor = useTenTap({
    bridges: [CoreBridge],
    tiptapOptions: {
      extensions,
    },
  });
  return (
    <EditorContent
      style={{
        fontFamily:
          "System, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif",
      }}
      editor={editor}
    />
  );
};
