import bigInt from 'big-integer';
import { udToDec } from '@urbit/api';
import { Editor, JSONContent } from '@tiptap/react';
import React, { useCallback, useEffect } from 'react';
import { useChatState, useMessagesForChat } from '../../state/chat';
import { ChatInline, ChatMemo } from '../../types/chat';
import MessageEditor, {
  useMessageEditor,
} from '../../components/MessageEditor';
import Avatar from '../../components/Avatar';
import ShipName from '../../components/ShipName';
import AddIcon from '../../components/icons/AddIcon';
import XIcon from '../../components/icons/XIcon';
import { useChatStore } from '../useChatStore';

interface ChatInputProps {
  flag: string;
  replying: string | null;
  showReply?: boolean;
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

export default function ChatInput({
  flag,
  replying,
  showReply = false,
}: ChatInputProps) {
  const messages = useMessagesForChat(flag);
  const replyingWrit = replying && messages.get(bigInt(udToDec(replying)));
  const ship = replyingWrit && replyingWrit.memo.author;

  console.log(replying);

  const closeReply = useCallback(() => {
    useChatStore.getState().reply(flag, null);
  }, [flag]);

  const onSubmit = useCallback(
    (editor: Editor) => {
      if (!editor.getText()) {
        return;
      }

      console.log('submitting', replying);
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
      setTimeout(() => closeReply(), 0);
    },
    [flag, replying, closeReply]
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

  useEffect(() => {
    if (replying) {
      messageEditor?.commands.focus();
    }
  }, [replying, messageEditor]);

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
        {showReply && ship && replying ? (
          <div className="mb-4 flex items-center justify-start font-semibold">
            <span className="text-gray-600">Replying to</span>
            <Avatar size="xs" ship={ship} className="ml-2" />
            <ShipName name={ship} className="ml-2" />
            <button className="icon-button ml-auto" onClick={closeReply}>
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className="relative">
          <MessageEditor editor={messageEditor} className="w-full" />
          <button
            className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
            aria-label="Add attachment"
            onClick={() => {
              useChatState.getState().sendMessage(flag, {
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
      </div>
      <button className="button" onClick={onClick}>
        Send
      </button>
    </div>
  );
}
