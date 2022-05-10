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
import { useChatState } from '../../state/chat';
import { ChatMemo } from '../../types/chat';

interface ChatInputProps {
  flag: string;
  replying?: string;
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
  const { flag, replying = null } = props;
  const onSubmit = useCallback(
    (editor: Editor) => {
      const memo: ChatMemo = {
        replying,
        author: `~${window.ship || 'zod'}`,
        sent: Date.now(),
        content: {
          inline: [parseTipTapJSON(editor?.getJSON())],
          block: [],
        },
      };
      useChatState.getState().sendMessage(flag, memo);
      editor?.commands.setContent('');
    },
    [flag, replying]
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

  const onClick = useCallback(
    () => editor && onSubmit(editor),
    [editor, onSubmit]
  );

  return (
    <div className="flex w-full items-end space-x-2">
      <EditorContent className="flex-1" editor={editor} />
      <button className="button" onClick={onClick}>
        Send
      </button>
    </div>
  );
}
