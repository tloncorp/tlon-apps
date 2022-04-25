import { EditorContent, useEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import StarterKit from '@tiptap/starter-kit';
import React, { FormEvent, useCallback } from 'react';
import { useChatState } from '../state/chat';
import { ChatMemo } from '../types/chat';
import Button from './Button';

interface ChatInputProps {
  flag: string;
}

const defaultEnter = Extension.create({
  priority: 999999,
  addKeyboardShortcuts() {
    return {
      Enter: () => true,
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('eventHandler'),
        props: {
          handleKeyDown() {
            return true;
          },
        },
      }),
    ];
  },
});

export default function ChatInput(props: ChatInputProps) {
  const { flag } = props;
  const editor = useEditor({
    extensions: [StarterKit, defaultEnter],
    content: '',
    editorProps: {
      attributes: {
        class: 'input',
      },
    },
  });

  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();

      const memo: ChatMemo = {
        replying: null,
        author: `~${window.ship}`,
        sent: Date.now(),
        content: JSON.stringify(editor?.getJSON()),
      };
      useChatState.getState().sendMessage(flag, memo);
      editor?.commands.clearContent();
    },
    [editor, flag]
  );

  return (
    <form onSubmit={onSubmit} className="flex w-full items-end space-x-2">
      <EditorContent className="flex-1" editor={editor} />
      <Button type="submit">Send</Button>
    </form>
  );
}
