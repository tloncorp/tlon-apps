import { Editor, JSONContent } from '@tiptap/react';
import React, { useCallback, useEffect } from 'react';
import { HeapInline, CurioHeart } from '@/types/heap';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import { useIsMobile } from '@/logic/useMedia';
import { useHeapState } from '@/state/heap/heap';

interface HeapTextInputProps {
  flag: string;
  sendDisabled?: boolean;
}

// TODO: should these be extracted to a common lib for usage in both ChatInput and HeapTextInput?
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
function parseTipTapJSON(json: JSONContent): HeapInline[] | HeapInline {
  if (json.content) {
    if (json.content.length === 1) {
      if (json.type === 'blockquote') {
        const parsed = parseTipTapJSON(json.content[0]);
        return {
          blockquote: Array.isArray(parsed) ? parsed : [parsed],
        } as HeapInline;
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
      [] as HeapInline[]
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
    } as unknown as HeapInline;
  }

  if (json.type === 'paragraph') {
    return {
      break: null,
    };
  }

  return json.text || '';
}

export default function HeapTextInput({
  flag,
  sendDisabled = false,
}: HeapTextInputProps) {
  const isMobile = useIsMobile();

  const onSubmit = useCallback(
    async (editor: Editor) => {
      if (!editor.getText()) {
        return;
      }

      const data = parseTipTapJSON(editor?.getJSON());
      const heart: CurioHeart = {
        title: null, // TODO: do we need to set a title?
        replying: null,
        author: window.our,
        sent: Date.now(),
        content: Array.isArray(data) ? data : [data],
      };

      await useHeapState.getState().addCurio(flag, heart);
      editor?.commands.setContent('');
    },
    [flag]
  );

  const messageEditor = useMessageEditor({
    content: '',
    placeholder: 'Enter Text Here',
    onEnter: useCallback(
      ({ editor }) => {
        onSubmit(editor);
        return true;
      },
      [onSubmit]
    ),
  });

  useEffect(() => {
    if (flag) {
      messageEditor?.commands.setContent('');
    }
  }, [flag, messageEditor]);

  const onClick = useCallback(
    () => messageEditor && onSubmit(messageEditor),
    [messageEditor, onSubmit]
  );

  if (!messageEditor) {
    return null;
  }

  return (
    <>
      <div className="relative flex-1 p-1">
        <MessageEditor
          editor={messageEditor}
          className="h-full w-full rounded-lg"
          // Since TipTap simulates an input using a <p> tag, only style
          // the fake placeholder when the field is empty
          inputClassName={
            messageEditor.getText() === '' ? 'font-semibold text-gray-400' : ''
          }
        />
        <button
          className="button absolute bottom-3 right-3 rounded-md px-2 py-1"
          disabled={sendDisabled || messageEditor.getText() === ''}
          onClick={onClick}
        >
          Post
        </button>
      </div>
      {isMobile && messageEditor.isFocused ? (
        <ChatInputMenu editor={messageEditor} />
      ) : null}
    </>
  );
}
