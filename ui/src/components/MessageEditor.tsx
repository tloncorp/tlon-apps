import cn from 'classnames';
import {
  Editor,
  EditorContent,
  Extension,
  JSONContent,
  useEditor,
} from '@tiptap/react';
import React, { useCallback, useMemo, useState } from 'react';
import Document from '@tiptap/extension-document';
import Blockquote from '@tiptap/extension-blockquote';
import Placeholder from '@tiptap/extension-placeholder';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import Link from '@tiptap/extension-link';
import Text from '@tiptap/extension-text';
import History from '@tiptap/extension-history';
import Paragraph from '@tiptap/extension-paragraph';
import HardBreak from '@tiptap/extension-hard-break';
import { useIsMobile } from '@/logic/useMedia';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import { refPasteRule, Shortcuts } from '@/logic/tiptap';
import { ChatBlock, Cite } from '@/types/chat';
import { useChatStore } from '@/chat/useChatStore';
import { useCalm } from '@/state/settings';
import Mention from '@tiptap/extension-mention';
import MentionPopup from './Mention/MentionPopup';

interface HandlerParams {
  editor: Editor;
}

interface useMessageEditorParams {
  whom?: string;
  content: JSONContent | string;
  placeholder?: string;
  editorClass?: string;
  allowMentions?: boolean;
  onEnter: ({ editor }: HandlerParams) => boolean;
  onUpdate?: ({ editor }: HandlerParams) => void;
}

export function useMessageEditor({
  whom,
  content,
  placeholder,
  editorClass,
  allowMentions = false,
  onEnter,
  onUpdate,
}: useMessageEditorParams) {
  const calm = useCalm();

  const onReference = useCallback(
    (r) => {
      if (!whom) {
        return;
      }
      const { chats, setBlocks } = useChatStore.getState();
      console.log(r);
      const blocks = chats[whom]?.blocks || [];
      setBlocks(whom, [...blocks, { cite: r }]);
    },
    [whom]
  );

  const keyMapExt = useMemo(
    () =>
      Shortcuts({
        Enter: ({ editor }) => onEnter({ editor } as any),
        'Shift-Enter': ({ editor }) =>
          editor.commands.first(({ commands }) => [
            () => commands.newlineInCode(),
            () => commands.createParagraphNear(),
            () => commands.liftEmptyBlock(),
            () => commands.splitBlock(),
          ]),
      }),
    [onEnter]
  );

  const extensions = [
    Blockquote,
    Bold,
    Code.extend({ excludes: undefined }),
    CodeBlock,
    Document,
    HardBreak,
    History.configure({ newGroupDelay: 100 }),
    Italic,
    keyMapExt,
    Link.configure({
      openOnClick: false,
    }),
    Paragraph,
    Placeholder.configure({ placeholder }),
    Strike,
    Text.extend({
      addPasteRules() {
        return [refPasteRule(onReference)];
      },
    }),
  ];

  if (allowMentions) {
    extensions.unshift(
      Mention.extend({ priority: 1000 }).configure({
        HTMLAttributes: {
          class: 'inline-block rounded bg-blue-soft px-1.5 py-0 text-blue',
        },
        suggestion: MentionPopup,
      })
    );
  }

  return useEditor(
    {
      extensions,
      content: content || '',
      editorProps: {
        attributes: {
          class: cn('input-inner', editorClass),
          'aria-label': 'Message editor with formatting menu',
          spellcheck: `${!calm.disableSpellcheck}`,
        },
      },
      onUpdate: ({ editor }) => {
        if (onUpdate) {
          onUpdate({ editor } as HandlerParams);
        }
      },
    },
    [keyMapExt, placeholder]
  );
}

interface MessageEditorProps {
  editor: Editor;
  className?: string;
  inputClassName?: string;
}

export default function MessageEditor({
  editor,
  className,
  inputClassName,
}: MessageEditorProps) {
  const isMobile = useIsMobile();
  return (
    <div className={cn('input block p-0', className)}>
      {/* This is nested in a div so that the bubble  menu is keyboard accessible */}
      <EditorContent className={cn('w-full', inputClassName)} editor={editor} />
      {!isMobile ? <ChatInputMenu editor={editor} /> : null}
    </div>
  );
}
