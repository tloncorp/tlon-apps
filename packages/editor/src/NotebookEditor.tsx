import { CoreBridge, useTenTap } from '@10play/tentap-editor';
import { EditorOptions, KeyboardShortcutCommand, Range } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import BulletList from '@tiptap/extension-bullet-list';
import Code from '@tiptap/extension-code';
import Document from '@tiptap/extension-document';
import FloatingMenu from '@tiptap/extension-floating-menu';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import History from '@tiptap/extension-history';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import ListItem from '@tiptap/extension-list-item';
import Mention from '@tiptap/extension-mention';
import OrderedList from '@tiptap/extension-ordered-list';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Strike from '@tiptap/extension-strike';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import Text from '@tiptap/extension-text';
import { EditorContent } from '@tiptap/react';

import DiaryCiteNode from './components/DiaryCiteNode';
import DiaryImageNode from './components/DiaryImageNode';
import DiaryLinkNode from './components/DiaryLinkNode';
import PrismCodeBlock from './components/PrismCodeBlock';
import ActionMenu, {
  ActionMenuBar,
  actionMenuItems,
} from './components/plugins/actionmenu';

export const NotebookEditor = () => {
  const extensions = [
    Blockquote,
    Bold.extend({ exitable: true }),
    BulletList,
    Code.extend({
      excludes: undefined,
      exitable: true,
    }).configure({
      HTMLAttributes: {
        class: 'rounded px-1 bg-gray-50 dark:bg-gray-100',
      },
    }),
    // TODO: figure out why we see the invalid unicode issue with PrismCodeBlock
    // PrismCodeBlock,
    Document,
    FloatingMenu,
    HardBreak,
    Heading,
    History.configure({ newGroupDelay: 100 }),
    HorizontalRule,
    Italic.extend({ exitable: true }),
    Link.configure({
      openOnClick: false,
    }).extend({ exitable: true }),
    ListItem,
    // Mention.extend({ priority: 1000 }).configure({
    // HTMLAttributes: {
    // class: 'inline-block rounded bg-blue-soft px-1.5 py-0 text-blue',
    // },
    // renderLabel: (props) => `~${props.node.attrs.id}`,
    // suggestion: getMentionPopup('~'),
    // }),
    // Mention.extend({ priority: 1000 }).configure({
    // HTMLAttributes: {
    // class: 'inline-block rounded bg-blue-soft px-1.5 py-0 text-blue',
    // },
    // renderLabel: (props) => `~${props.node.attrs.id}`,
    // suggestion: getMentionPopup('@'),
    // }),
    OrderedList,
    Paragraph,
    Placeholder.configure({
      placeholder: 'Start writing here, or click the menu to add a link block',
      showOnlyCurrent: true,
      showOnlyWhenEditable: false,
      includeChildren: true,
    }),
    Strike.extend({ exitable: true }),
    Text,
    ActionMenu,
    DiaryImageNode,
    DiaryLinkNode,
    DiaryCiteNode,
    TaskList,
    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: 'flex justify-items-start space-x-2',
      },
    }),
  ];

  const editor = useTenTap({
    bridges: [CoreBridge],
    tiptapOptions: {
      extensions,
    },
  });
  return (
    <EditorContent
      style={{
        fontFamily:
          "System, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif",
      }}
      editor={editor}
    />
  );
};
