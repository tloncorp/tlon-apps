import { Editor, JSONContent } from '@tiptap/react';
import React, { useCallback, useEffect } from 'react';
import {
  HeapInline,
  CurioHeart,
  HeapInlineKey,
  HeapDisplayMode,
  LIST,
} from '@/types/heap';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import { useIsMobile } from '@/logic/useMedia';
import { useHeapState } from '@/state/heap/heap';
import { reduce } from 'lodash';
import classNames from 'classnames';
import useRequestState from '@/logic/useRequestState';

interface HeapTextInputProps {
  flag: string;
  sendDisabled?: boolean;
  displayType: HeapDisplayMode;
  draft: JSONContent | undefined;
  setDraft: React.Dispatch<React.SetStateAction<JSONContent | undefined>>;
  replyTo?: string | null;
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
function parseTipTapJSON(json: JSONContent): HeapInline[] {
  if (json.content) {
    if (json.content.length === 1) {
      if (json.type === 'blockquote') {
        const parsed = parseTipTapJSON(json.content[0]);
        return [
          {
            blockquote: parsed,
          },
        ];
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
      return [
        {
          link: {
            href: first.attrs.href,
            content: json.text || first.attrs.href,
          },
        },
      ];
    }

    return [
      {
        [convertMarkType(first.type)]: parseTipTapJSON(json),
      },
    ] as unknown as HeapInline[];
  }

  if (json.type === 'paragraph') {
    return [
      {
        break: null,
      },
    ];
  }

  return [json.text || ''];
}

const MERGEABLE_KEYS = ['italics', 'bold', 'strike', 'blockquote'] as const;
function isMergeable(x: HeapInlineKey): x is typeof MERGEABLE_KEYS[number] {
  return MERGEABLE_KEYS.includes(x as any);
}
function normalizeHeapInline(inline: HeapInline[]): HeapInline[] {
  return reduce(
    inline,
    (acc: HeapInline[], val) => {
      if (acc.length === 0) {
        return [...acc, val];
      }
      const last = acc[acc.length - 1];
      if (typeof last === 'string' && typeof val === 'string') {
        return [...acc.slice(0, -1), last + val];
      }
      const lastKey = Object.keys(acc[acc.length - 1])[0] as HeapInlineKey;
      const currKey = Object.keys(val)[0] as keyof HeapInlineKey;
      if (isMergeable(lastKey) && currKey === lastKey) {
        // @ts-expect-error keying weirdness
        const end: HeapInline = {
          // @ts-expect-error keying weirdness
          [lastKey]: [...last[lastKey as any], ...val[currKey as any]],
        };
        return [...acc.slice(0, -1), end];
      }
      return [...acc, val];
    },
    []
  );
}

export default function HeapTextInput({
  flag,
  sendDisabled = false,
  replyTo = null,
  displayType,
  draft,
  setDraft,
}: HeapTextInputProps) {
  const isMobile = useIsMobile();
  const { isPending, setPending, setReady } = useRequestState();

  const onSubmit = useCallback(
    async (editor: Editor) => {
      if (!editor.getText()) {
        return;
      }

      setPending();

      const content = normalizeHeapInline(parseTipTapJSON(editor?.getJSON()));

      const heart: CurioHeart = {
        title: null, // TODO: do we need to set a title?
        replying: replyTo,
        author: window.our,
        sent: Date.now(),
        content,
      };

      await useHeapState.getState().addCurio(flag, heart);
      setDraft(undefined);
      editor?.commands.setContent('');
      setReady();
    },
    [flag, setDraft, setPending, setReady, replyTo]
  );

  const onUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      setDraft(editor.getJSON());
    },
    [setDraft]
  );

  const messageEditor = useMessageEditor({
    content: draft || '',
    placeholder: 'Enter Text Here',
    onUpdate,
    onEnter: useCallback(
      ({ editor }) => {
        onSubmit(editor);
        return true;
      },
      [onSubmit]
    ),
  });

  useEffect(() => {
    if (flag && messageEditor && !messageEditor.isDestroyed) {
      messageEditor?.commands.setContent('');
    }
  }, [flag, messageEditor]);

  useEffect(() => {
    if (draft && messageEditor && !messageEditor.isDestroyed) {
      messageEditor.commands.setContent(draft);
    }
    // only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageEditor]);

  const onClick = useCallback(
    () => messageEditor && onSubmit(messageEditor),
    [messageEditor, onSubmit]
  );

  if (!messageEditor) {
    return null;
  }

  // TODO: Set a sane length limit for comments
  return (
    <>
      <div className="relative flex-1 p-1">
        <MessageEditor
          editor={messageEditor}
          className="h-full w-full rounded-lg"
          inputClassName={classNames(
            // Since TipTap simulates an input using a <p> tag, only style
            // the fake placeholder when the field is empty
            messageEditor.getText() === '' ? 'font-semibold text-gray-400' : '',
            displayType === LIST ? 'min-h-[44px]' : ''
          )}
        />
        <button
          className="button absolute bottom-3 right-3 rounded-md px-2 py-1"
          disabled={sendDisabled || isPending || messageEditor.getText() === ''}
          onClick={onClick}
        >
          {isPending ? 'Posting...' : 'Post'}
        </button>
      </div>
      {isMobile && messageEditor.isFocused ? (
        <ChatInputMenu editor={messageEditor} />
      ) : null}
    </>
  );
}
