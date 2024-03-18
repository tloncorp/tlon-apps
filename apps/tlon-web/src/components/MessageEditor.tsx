import Blockquote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Strike from '@tiptap/extension-strike';
import Text from '@tiptap/extension-text';
import { Slice } from '@tiptap/pm/model';
import { EditorView } from '@tiptap/pm/view';
import { Editor, EditorContent, JSONContent, useEditor } from '@tiptap/react';
import { Cite } from '@tloncorp/shared/dist/urbit/channel';
import cn from 'classnames';
import React, { useCallback, useMemo } from 'react';

import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import {
  chatStoreLogger,
  useChatBlocks,
  useChatStore,
} from '@/chat/useChatStore';
import { PASTEABLE_MEDIA_TYPES } from '@/constants';
import { Shortcuts, refPasteRule } from '@/logic/tiptap';
import { useIsMobile } from '@/logic/useMedia';
import { useCalm } from '@/state/settings';
import { useFileStore } from '@/state/storage';

import getMentionPopup from './Mention/MentionPopup';

export interface HandlerParams {
  editor: Editor;
}

interface useMessageEditorParams {
  whom?: string;
  content: JSONContent | string;
  uploadKey: string;
  placeholder?: string;
  editorClass?: string;
  allowMentions?: boolean;
  onEnter: ({ editor }: HandlerParams) => boolean;
  onUpdate?: ({ editor }: HandlerParams) => void;
}

/**
 * !!! CAUTION !!!
 *
 * Anything passed to this hook which causes a recreation of the editor
 * will cause it to lose focus, tread with caution.
 *
 */

export function useMessageEditor({
  whom,
  content,
  uploadKey,
  placeholder,
  editorClass,
  allowMentions = false,
  onEnter,
  onUpdate,
}: useMessageEditorParams) {
  const calm = useCalm();
  const chatBlocks = useChatBlocks(whom);
  const { setBlocks } = useChatStore.getState();

  const onReference = useCallback(
    (r: Cite) => {
      if (!whom) {
        return;
      }
      setBlocks(whom, [...chatBlocks, { cite: r }]);
      chatStoreLogger.log('onReference', { whom, r, chatBlocks });
    },
    [chatBlocks, setBlocks, whom]
  );

  const handlePaste = useCallback(
    (_view: EditorView, event: ClipboardEvent, _slice: Slice) => {
      if (!whom) {
        return false;
      }

      const uploader = useFileStore.getState().getUploader(uploadKey);
      if (
        uploader &&
        event.clipboardData &&
        Array.from(event.clipboardData.files).some((f) =>
          PASTEABLE_MEDIA_TYPES.includes(f.type)
        )
      ) {
        // TODO should blocks first be updated here to show the loading state?
        uploader.uploadFiles(event.clipboardData.files);
        useFileStore.getState().setUploadType(uploadKey, 'paste');
        return true;
      }

      return false;
    },
    [uploadKey, whom]
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
    Code.extend({
      excludes: undefined,
      exitable: true,
    }).configure({
      HTMLAttributes: {
        class: 'rounded px-1 bg-gray-50 dark:bg-gray-100',
      },
    }),
    CodeBlock.configure({
      HTMLAttributes: {
        class: 'mr-4 px-2 rounded bg-gray-50 dark:bg-gray-100',
      },
    }),
    Document,
    HardBreak,
    History.configure({ newGroupDelay: 100 }),
    Italic,
    keyMapExt,
    Link.configure({
      openOnClick: false,
    }).extend({
      exitable: true,
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
        renderLabel: (props) => `~${props.node.attrs.id}`,
        suggestion: getMentionPopup('~'),
      })
    );
    extensions.unshift(
      Mention.extend({ priority: 999, name: 'at-mention' }).configure({
        HTMLAttributes: {
          class: 'inline-block rounded bg-blue-soft px-1.5 py-0 text-blue',
        },
        renderLabel: (props) => `~${props.node.attrs.id}`,
        suggestion: getMentionPopup('@'),
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
        handlePaste,
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
  const classes = cn('w-full', inputClassName);
  return (
    <div className={cn('input block p-0', className)}>
      {/* This is nested in a div so that the bubble  menu is keyboard accessible */}
      <EditorContent className={classes} editor={editor} />
      {!isMobile ? <ChatInputMenu editor={editor} /> : null}
    </div>
  );
}
