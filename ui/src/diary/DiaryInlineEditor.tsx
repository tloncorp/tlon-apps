import classNames from 'classnames';
import { EditorView } from 'prosemirror-view';
import { PluginKey } from 'prosemirror-state';
import {
  Editor as EditorCore,
  EditorOptions,
  KeyboardShortcutCommand,
  Range,
} from '@tiptap/core';
import {
  Editor,
  EditorContent,
  Extension,
  JSONContent,
  ReactRenderer,
  useEditor,
} from '@tiptap/react';
import React, {
  useEffect,
  useImperativeHandle,
  useState,
  forwardRef,
  useMemo,
} from 'react';
import Document from '@tiptap/extension-document';
import Blockquote from '@tiptap/extension-blockquote';
import Placeholder from '@tiptap/extension-placeholder';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import Link from '@tiptap/extension-link';
import Text from '@tiptap/extension-text';
import cn from 'classnames';
import History from '@tiptap/extension-history';
import Paragraph from '@tiptap/extension-paragraph';
import HardBreak from '@tiptap/extension-hard-break';
import { useCalm } from '@/state/settings';
import { useIsMobile } from '@/logic/useMedia';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import { Shortcuts } from '@/logic/tiptap';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import tippy from 'tippy.js';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Heading from '@tiptap/extension-heading';
import Mention from '@tiptap/extension-mention';
import MentionPopup from '@/components/Mention/MentionPopup';
import PrismCodeBlock from './PrismCodeBlock';
import DiaryCiteNode from './DiaryCiteNode';
import DiaryLinkNode from './DiaryLinkNode';
import DiaryImageNode from './DiaryImageNode';

EditorView.prototype.updateState = function updateState(state) {
  if (!(this as any).docView) return; // This prevents the matchesNode error on hot reloads
  (this as any).updateStateInner(state, this.state.plugins != state.plugins); //eslint-disable-line
};

interface useDiaryInlineEditorParams {
  content: JSONContent | string;
  placeholder?: string;
  onEnter: KeyboardShortcutCommand;
  onUpdate?: EditorOptions['onUpdate'];
  autofocus?: boolean;
}
const ActionMenuPluginKey = new PluginKey('action-menu');

interface ActionMenuItemProps {
  title: string;
  command: (p: { editor: Editor; range: Range }) => void;
}

const ActionMenuBar = forwardRef<
  any,
  { items: ActionMenuItemProps[]; command: any }
>((props, ref) => {
  console.log(props);
  const { items = [] } = props;
  const [selected, setSelected] = useState(0);
  const selectItem = (index: number) => {
    const item = items[index];
    if (item) {
      props.command(item);
    }
  };

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      const len = items.length;
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s + len - 1) % len);
        return true;
      }

      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % len);
        return true;
      }

      if (event.key === 'Enter') {
        selectItem(selected);
        return true;
      }

      return false;
    },
  }));

  const onClick = (idx: number) => {
    selectItem(idx);
  };

  return (
    <ul className="w-32 border border-black bg-white" ref={ref}>
      {items.map((s: ActionMenuItemProps, idx: number) => (
        <li
          key={s.title}
          onClick={() => selectItem(idx)}
          className={cn(
            'w-100 cursor-pointer p-2 hover:bg-gray-50',
            selected === idx ? 'bg-gray-100' : 'bg-white'
          )}
        >
          {s.title}
        </li>
      ))}
    </ul>
  );
});

interface ActionMenuOptions {
  suggestion: Omit<SuggestionOptions, 'editor'>;
}

const ActionMenu = Extension.create<ActionMenuOptions>({
  name: 'action-menu',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        pluginKey: ActionMenuPluginKey,
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        items: ({ query }: any): ActionMenuItemProps[] => {
          const nedl = query.toLowerCase();

          const hstk: ActionMenuItemProps[] = [
            {
              title: 'Image',
              command: ({ editor, range }) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .splitBlock()
                  .insertContent([
                    { type: 'diary-image' },
                    { type: 'paragraph' },
                  ])
                  .selectNodeBackward()
                  .run();
              },
            },
            {
              title: 'Web Link',
              command: ({ editor, range }) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContent([
                    { type: 'diary-link' },
                    { type: 'paragraph' },
                  ])
                  .selectNodeBackward()
                  .run();
              },
            },
            {
              title: 'Urbit Reference',
              command: ({ editor, range }) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContent([
                    { type: 'diary-cite' },
                    { type: 'paragraph' },
                  ])
                  .selectNodeBackward()
                  .run();
              },
            },
            {
              title: 'Blockquote',
              command: ({ editor, range }) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleBlockquote()
                  .run();
              },
            },
            {
              title: 'Code block',
              command: ({ editor, range }) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleCodeBlock()
                  .run();
              },
            },
          ];
          return hstk.filter(
            ({ title }) => title.toLowerCase().search(nedl) !== -1
          );
        },
        render: () => {
          let component: ReactRenderer<any, any> | null;
          let popup: any;
          return {
            onStart: (props) => {
              component = new ReactRenderer<any, any>(ActionMenuBar, props);
              component.updateProps(props);

              if (!props.clientRect) {
                return;
              }

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as any,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },
            onUpdate: (props) => {
              if (props.items.length === 0) {
                popup[0]?.hide();
                return true;
              }
              component?.updateProps(props);

              popup[0].setProps({
                getBoundingClientRect: props.clientRect,
              });
              return true;
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                popup[0]?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(props);
            },
            onExit: () => {
              popup[0].destroy();
              component?.destroy();
            },
          };
        },
      },
    };
  },
  addProseMirrorPlugins() {
    return [Suggestion({ ...this.options.suggestion, editor: this.editor })];
  },
});

export function useDiaryInlineEditor({
  content,
  placeholder,
  autofocus = false,
  onEnter,
  onUpdate,
}: useDiaryInlineEditorParams) {
  const calm = useCalm();

  const ed = useEditor(
    {
      extensions: [
        Blockquote,
        Bold.extend({ exitable: true, inclusive: false }),
        BulletList,
        Code.extend({
          excludes: undefined,
          exitable: true,
          inclusive: false,
        }).configure({
          HTMLAttributes: {
            class: 'rounded px-1 bg-gray-50 dark:bg-gray-100',
          },
        }),
        PrismCodeBlock,
        Document,
        HardBreak,
        Heading,
        History.configure({ newGroupDelay: 100 }),
        HorizontalRule,
        Italic.extend({ exitable: true, inclusive: false }),
        Link.configure({
          openOnClick: false,
        }).extend({ exitable: true, inclusive: false }),
        ListItem,
        Mention.extend({ priority: 1000 }).configure({
          HTMLAttributes: {
            class: 'inline-block rounded bg-blue-soft px-1.5 py-0 text-blue',
          },
          suggestion: MentionPopup,
        }),
        OrderedList,
        Paragraph,
        Placeholder.configure({
          placeholder:
            'Start writing here. Highlight text to add formatting, or type the forward slash (/) to insert block content.',
          showOnlyCurrent: false,
          showOnlyWhenEditable: false,
          includeChildren: true,
        }),
        Strike.extend({ exitable: true, inclusive: false }),
        Text,
        Shortcuts({
          Enter: onEnter,
        }),
        ActionMenu,
        DiaryImageNode,
        DiaryLinkNode,
        DiaryCiteNode,
      ],
      content: content || '',
      editorProps: {
        attributes: {
          'aria-label': 'Note editor with formatting menu',
          spellcheck: `${!calm.disableSpellcheck}`,
        },
      },
      onUpdate: onUpdate || (() => false),
      onCreate: ({ editor }) => {
        if (autofocus) {
          editor.chain().focus().run();
        }
      },
    },
    [placeholder, autofocus]
  );

  useEffect(() => {
    if (ed && !ed.isDestroyed) {
      const com = ed.chain().clearContent().insertContent(content);
      if (content !== '') {
        com.focus();
      }
      com.run();
    }
  }, [ed, content]);

  return ed;
}

interface DiaryInlineEditorProps {
  editor: Editor;
  className?: string;
}

export default function DiaryInlineEditor({
  editor,
  className,
}: DiaryInlineEditorProps) {
  const isMobile = useIsMobile();

  return (
    <div className={classNames('input-transparent block p-0', className)}>
      {/* This is nested in a div so that the bubble  menu is keyboard accessible */}
      <EditorContent
        className="prose-lg prose w-full dark:prose-invert"
        editor={editor}
      />
      {!isMobile ? <ChatInputMenu editor={editor} /> : null}
    </div>
  );
}
