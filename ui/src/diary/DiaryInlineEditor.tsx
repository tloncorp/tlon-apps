import cn from 'classnames';
import * as Popover from '@radix-ui/react-popover';
import { EditorView } from '@tiptap/pm/view';
import { EditorOptions, KeyboardShortcutCommand, Range } from '@tiptap/core';
import { useState } from 'react';
import {
  Editor,
  EditorContent,
  JSONContent,
  useEditor,
  FloatingMenu as FloatingMenuComponent,
} from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Blockquote from '@tiptap/extension-blockquote';
import Placeholder from '@tiptap/extension-placeholder';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import Link from '@tiptap/extension-link';
import Text from '@tiptap/extension-text';
import History from '@tiptap/extension-history';
import Paragraph from '@tiptap/extension-paragraph';
import HardBreak from '@tiptap/extension-hard-break';
import FloatingMenu from '@tiptap/extension-floating-menu';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useCalm } from '@/state/settings';
import { useIsMobile } from '@/logic/useMedia';
import ChatInputMenu from '@/chat/ChatInputMenu/ChatInputMenu';
import { Shortcuts } from '@/logic/tiptap';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Heading from '@tiptap/extension-heading';
import Mention from '@tiptap/extension-mention';
import getMentionPopup from '@/components/Mention/MentionPopup';
import AddIcon16 from '@/components/icons/Add16Icon';
import IconButton from '@/components/IconButton';
import ActionMenu, {
  ActionMenuBar,
  actionMenuItems,
} from './plugins/actionmenu';
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
        PrismCodeBlock,
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
        Mention.extend({ priority: 1000 }).configure({
          HTMLAttributes: {
            class: 'inline-block rounded bg-blue-soft px-1.5 py-0 text-blue',
          },
          renderLabel: (props) => `~${props.node.attrs.id}`,
          suggestion: getMentionPopup('~'),
        }),
        Mention.extend({ priority: 1000 }).configure({
          HTMLAttributes: {
            class: 'inline-block rounded bg-blue-soft px-1.5 py-0 text-blue',
          },
          renderLabel: (props) => `~${props.node.attrs.id}`,
          suggestion: getMentionPopup('@'),
        }),
        OrderedList,
        Paragraph,
        Placeholder.configure({
          placeholder:
            'Start writing here, or click the menu to add a link block',
          showOnlyCurrent: true,
          showOnlyWhenEditable: false,
          includeChildren: true,
        }),
        Strike.extend({ exitable: true }),
        Text,
        Shortcuts({
          Enter: onEnter,
        }),
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
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={cn('input-transparent block p-0', className)}>
      {editor && (
        <FloatingMenuComponent
          editor={editor}
          tippyOptions={{ duration: 0, offset: [0, -50] }}
        >
          <div className="flex items-center justify-center">
            <Popover.Root open={showMenu} onOpenChange={setShowMenu}>
              <Popover.Anchor>
                <IconButton
                  icon={
                    <AddIcon16 className="h-6 w-6 rounded bg-gray-50 p-1 text-gray-600" />
                  }
                  label="Insert"
                  showTooltip
                  action={() => setShowMenu(!showMenu)}
                />
              </Popover.Anchor>
              <Popover.Content>
                <div className="flex items-center justify-center">
                  <ActionMenuBar
                    highlight={false}
                    items={actionMenuItems}
                    command={({
                      command,
                    }: {
                      command: ({
                        // eslint-disable-next-line no-shadow
                        editor,
                        range,
                      }: {
                        editor: Editor;
                        range: Range;
                      }) => void;
                    }) => {
                      command({
                        editor,
                        range: {
                          from: editor.state.selection.from,
                          to: editor.state.selection.to,
                        },
                      });
                    }}
                  />
                </div>
              </Popover.Content>
            </Popover.Root>
          </div>
        </FloatingMenuComponent>
      )}
      {/* This is nested in a div so that the bubble  menu is keyboard accessible */}
      <EditorContent
        className="prose prose-lg w-full dark:prose-invert"
        editor={editor}
      />
      {!isMobile ? <ChatInputMenu editor={editor} /> : null}
    </div>
  );
}
