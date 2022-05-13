import { Editor, JSONContent } from '@tiptap/react';
import React, { useCallback } from 'react';
import { useChatState } from '../../state/chat';
import { ChatInline, ChatMemo } from '../../types/chat';
import MessageEditor, { useMessageEditor } from '../MessageEditor';

interface ChatInputProps {
  flag: string;
  replying?: string;
}

function convertMarkType(type: string): string {
  switch (type) {
    case 'italic':
      return 'italics';
    case 'code':
      return 'inline-code';
    case 'link':
      return 'href';
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
        const parsed = parseTipTapJSON(json.content[0]);
        return {
          blockquote: Array.isArray(parsed) ? parsed : [parsed],
        } as ChatInline;
      }

      return parseTipTapJSON(json.content[0]);
    }

    /* Only allow two or less consecutive breaks */
    const breaksAdded: JSONContent[] = [];
    let count = 0;
    json.content.forEach((item) => {
      if (item.type === 'paragraph' && !item.content) {
        if (count === 1) {
          breaksAdded.push(item);
          count += 1;
        }
        return;
      }

      breaksAdded.push(item);

      if (item.type === 'paragraph' && item.content) {
        breaksAdded.push({ type: 'paragraph' });
        count = 1;
      }
    });

    return breaksAdded.reduce(
      (message, contents) => message.concat(parseTipTapJSON(contents)),
      [] as ChatInline[]
    );
  }

  if (json.marks && json.marks.length > 0) {
    const first = json.marks.pop();

    if (!first) {
      throw new Error('Unsure what this is');
    }

    if (first.type === 'link' && first.attrs) {
      return {
        link: {
          href: first.attrs.href,
          content: json.text || first.attrs.href,
        },
      };
    }

    return {
      [convertMarkType(first.type)]: parseTipTapJSON(json),
    } as unknown as ChatInline;
  }

  if (json.type === 'paragraph') {
    return {
      break: null,
    };
  }

  return json.text || '';
}

export default function ChatInput(props: ChatInputProps) {
  const { flag, replying = null } = props;
  const onSubmit = useCallback(
    (editor: Editor) => {
      if (!editor.getText()) {
        return;
      }

      const data = parseTipTapJSON(editor?.getJSON());
      const memo: ChatMemo = {
        replying,
        author: `~${window.ship || 'zod'}`,
        sent: Date.now(),
        content: {
          inline: Array.isArray(data) ? data : [data],
          block: [],
        },
      };
      useChatState.getState().sendMessage(flag, memo);
      editor?.commands.setContent('');
    },
    [flag, replying]
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
    <div>
      {replying ? (
        <div className="mb-4 flex items-center justify-between">
          <span className="text-gray-600">Replying to</span>
        </div>
      ) : null}
      <div className="flex w-full items-end space-x-2">
        <MessageEditor editor={messageEditor} className="flex-1" />
        <button className="button" onClick={onClick}>
          Send
        </button>
      </div>
    </div>
  );
}
