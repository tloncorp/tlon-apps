import { Editor, JSONContent } from '@tiptap/react';
import { debounce } from 'lodash';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  useChat,
  useChatDraft,
  useChatIsJoined,
  useChatState,
} from '../../state/chat';
import { ChatInline, ChatMemo, ChatMessage } from '../../types/chat';
import MessageEditor, { useMessageEditor } from '../MessageEditor';

interface ChatInputProps {
  flag: string;
  replying?: string | null;
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

/* this parser is still imperfect */
function parseChatMessage(message: ChatMessage): JSONContent {
  const parser = (inline: ChatInline): JSONContent => {
    if (typeof inline === 'string') {
      return { type: 'text', text: inline };
    }

    if ('blockquote' in inline) {
      return {
        type: 'blockquote',
        content: inline.blockquote.map(parser),
      };
    }

    const keys = Object.keys(inline);
    const simple = keys.find((k) => ['inline-code', 'tag'].includes(k));
    if (simple) {
      return {
        type: 'text',
        marks: [{ type: simple }],
        text: (inline as any)[simple] || '',
      };
    }

    const recursive = keys.find((k) =>
      ['bold', 'italics', 'strike'].includes(k)
    );
    if (recursive) {
      const item = (inline as any)[recursive];
      const hasNestedContent = typeof item === 'object';
      const content = hasNestedContent ? parser(item) : item;

      if (hasNestedContent) {
        return {
          marks: [{ type: recursive }],
          content: [content],
        };
      }

      return {
        type: 'text',
        marks: [{ type: recursive }],
        text: content,
      };
    }

    return { type: 'paragraph' };
  };

  if (message.inline.length === 0) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  return {
    type: 'doc',
    content: message.inline.map(parser),
  };
}

export default function ChatInput({ flag, replying = null }: ChatInputProps) {
  const chat = useChat(flag);
  const draft = useChatDraft(flag);
  const onUpdate = useRef(
    debounce(({ editor }) => {
      const data = parseTipTapJSON(editor?.getJSON());
      useChatState.getState().draft(flag, {
        inline: Array.isArray(data) ? data : [data],
        block: [],
      });
    }, 500)
  );
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

  useEffect(() => {
    if (chat) {
      useChatState.getState().getDraft(flag);
    }
  }, [flag, chat]);

  const messageEditor = useMessageEditor({
    content: '',
    placeholder: 'Message',
    onEnter: useCallback(
      ({ editor }) => {
        onSubmit(editor);
        return true;
      },
      [onSubmit]
    ),
    onUpdate: onUpdate.current,
  });

  useEffect(() => {
    if (draft && messageEditor) {
      messageEditor.commands.setContent(parseChatMessage(draft));
    }
  }, [draft, messageEditor]);

  const onClick = useCallback(
    () => messageEditor && onSubmit(messageEditor),
    [messageEditor, onSubmit]
  );

  if (!messageEditor) {
    return null;
  }

  return (
    <div className="flex w-full items-end space-x-2">
      <MessageEditor editor={messageEditor} className="flex-1" />
      <button className="button" onClick={onClick}>
        Send
      </button>
    </div>
  );
}
