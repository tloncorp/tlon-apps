import { Editor, EditorContent, JSONContent } from '@tiptap/react';
import React, { useCallback } from 'react';
import { useChatState } from '../../state/chat';
import { ChatInline, ChatMemo } from '../../types/chat';
import ChatInputMenu from '../ChatInputMenu/ChatInputMenu';
import MessageEditor, { useMessageEditor } from '../MessageEditor';

interface ChatInputProps {
  flag: string;
}

function convertMarkType(type: string): string {
  switch (type) {
    case 'italic':
      return 'italics';
    case 'code':
      return 'inline-code';
    default:
      return type;
  }
}

// this will be replaced with more sophisticated logic based on
// what we decide will be the message format
function parseTipTapJSON(json: JSONContent): ChatInline[] | ChatInline {
  if (json.content) {
    if (json.content.length === 1) {
      if (json.type === 'blockquote') {
        return {
          blockquote: parseTipTapJSON(json.content[0]),
        } as ChatInline;
      }

      return parseTipTapJSON(json.content[0]);
    }

    return json.content.reduce(
      (message, contents) => message.concat(parseTipTapJSON(contents)),
      [] as ChatInline[]
    );
  }

  if (json.marks && json.marks.length > 0) {
    const first = json.marks.pop();

    if (!first) {
      throw new Error('Unsure what this is');
    }

    return {
      [convertMarkType(first.type)]: parseTipTapJSON(json),
    } as unknown as ChatInline;
  }

  return json.text || '';
}

export default function ChatInput(props: ChatInputProps) {
  const { flag } = props;
  const onSubmit = useCallback(
    (editor: Editor) => {
      console.log(editor?.getJSON());
      const data = parseTipTapJSON(editor?.getJSON());
      const memo: ChatMemo = {
        replying: null,
        author: `~${window.ship || 'zod'}`,
        sent: Date.now(),
        content: {
          inline: Array.isArray(data) ? data : [data],
          block: [],
        },
      };
      console.log(memo.content);
      useChatState.getState().sendMessage(flag, memo);
      editor?.commands.setContent('');
    },
    [flag]
  );

  const messageEditor = useMessageEditor({
    placeholder: 'Message',
    onEnter: useCallback(
      ({ editor }) => {
        onSubmit(editor);
        return true;
      },
      [onSubmit]
    ),
  });

  const onClick = useCallback(
    () => messageEditor && onSubmit(messageEditor),
    [messageEditor, onSubmit]
  );

  if (!messageEditor) {
    return null;
  }

  return (
    <div className="flex w-full items-end space-x-2">
      <div className="flex-1">
        {/* This is nested in a div so that the bubble  menu is keyboard accessible */}
        <MessageEditor editor={messageEditor} />
        <ChatInputMenu editor={messageEditor} />
      </div>
      <button className="button" onClick={onClick}>
        Send
      </button>
    </div>
  );
}
