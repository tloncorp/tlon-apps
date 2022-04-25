import {
  Extension,
  Editor,
  EditorContent,
  KeyboardShortcutCommand,
  useEditor,
  JSONContent,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, { useCallback, useMemo } from 'react';
import { useChatState } from '../state/chat';
import { ChatMemo } from '../types/chat';
import Button from './Button';

interface ChatInputProps {
  flag: string;
}

// this will be replaced with more sophisticated logic based on
// what we decide will be the message format
function parseTipTapJSON(json: JSONContent): string {
  if (json.content) {
    return json.content.reduce(
      (message, contents) => message + parseTipTapJSON(contents),
      ''
    );
  }

  return json.text || '';
}

const keyMap = (onEnter: KeyboardShortcutCommand) =>
  Extension.create({
    priority: 999999,
    addKeyboardShortcuts() {
      return {
        Enter: ({ editor }) => onEnter({ editor }),
      };
    },
  });

export default function ChatInput(props: ChatInputProps) {
  const { flag } = props;
  const onSubmit = useCallback(
    (editor: Editor) => {
      const memo: ChatMemo = {
        replying: null,
        author: `~${window.ship}`,
        sent: Date.now(),
        content: parseTipTapJSON(editor?.getJSON()),
      };
      useChatState.getState().sendMessage(flag, memo);
      editor?.commands.setContent('');
    },
    [flag]
  );
  const keyMapExt = useMemo(
    () =>
      keyMap(({ editor }) => {
        onSubmit(editor as Editor);
        return true;
      }),
    [onSubmit]
  );
  const editor = useEditor({
    extensions: [StarterKit, keyMapExt],
    content: '',
    editorProps: {
      attributes: {
        class: 'input',
      },
    },
  });

  return (
    <div className="flex w-full items-end space-x-2">
      <EditorContent className="flex-1" editor={editor} />
      <Button onClick={() => editor && onSubmit(editor)}>Send</Button>
    </div>
  );
}
