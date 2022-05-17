import { Editor, JSONContent } from '@tiptap/react';
import React, { useCallback } from 'react';
import cn from 'classnames';
import { useChatState } from '../../state/chat';
import { ChatInline, ChatMemo, ChatWhom } from '../../types/chat';
import MessageEditor, { useMessageEditor } from '../MessageEditor';
import AddIcon from '../icons/AddIcon';

interface ChatInputProps {
  whom: string;
  replying?: string;
  className?: string;
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
  const { whom, replying = null, className = '' } = props;
  const onSubmit = useCallback(
    (editor: Editor) => {
      if (!editor.getText()) {
        return;
      }

      const data = parseTipTapJSON(editor?.getJSON());
      console.log(replying);
      const memo: ChatMemo = {
        replying,
        author: `~${window.ship || 'zod'}`,
        sent: Date.now(),
        content: {
          inline: Array.isArray(data) ? data : [data],
          block: [],
        },
      };
      useChatState.getState().sendMessage(whom, memo);
      editor?.commands.setContent('');
    },
    [whom, replying]
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
    <div className={cn('flex w-full items-end space-x-2', className)}>
      <div className="relative flex-1">
        <MessageEditor editor={messageEditor} className="w-full" />
        <button
          className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
          aria-label="Add attachment"
          onClick={() => {
            useChatState.getState().sendMessage(whom, {
              replying: null,
              author: `~${window.ship || 'zod'}`,
              sent: Date.now(),
              content: {
                inline: [],
                block: [
                  {
                    image: {
                      src: 'https://nyc3.digitaloceanspaces.com/hmillerdev/nocsyx-lassul/2022.3.21..22.06.42-FBqq4mCVkAM8Cs5.jpeg',
                      width: 750,
                      height: 599,
                      alt: '',
                    },
                  },
                ],
              },
            });
          }}
        >
          <AddIcon className="h-6 w-4" />
        </button>
      </div>
      <button className="button" onClick={onClick}>
        Send
      </button>
    </div>
  );
}
