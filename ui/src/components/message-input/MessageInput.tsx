import React from 'react';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import classNames from 'classnames';

interface MessageInputProps {
  editor: Editor;
  className?: string;
}

export default function MessageInput({ editor, className }: MessageInputProps) {
  return <EditorContent className={className} editor={editor} />;
}
