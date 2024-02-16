import { Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Editor, Extension, ReactRenderer } from '@tiptap/react';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import cn from 'classnames';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import tippy from 'tippy.js';

import useLeap from '@/components/Leap/useLeap';
import CheckIcon from '@/components/icons/CheckIcon';
import CodeIcon from '@/components/icons/CodeIcon';
import ShapesIcon from '@/components/icons/ShapesIcon';
import Sig16Icon from '@/components/icons/Sig16Icon';
import keyMap from '@/keyMap';

const ActionMenuPluginKey = new PluginKey('action-menu');

interface ActionMenuItemProps {
  title: string;
  command: (p: { editor: Editor; range: Range }) => void;
  icon: React.ReactNode;
}

export const actionMenuItems: ActionMenuItemProps[] = [
  {
    title: 'Image',
    icon: <ShapesIcon className="mr-2 h-4 w-4 text-gray-600" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent([{ type: 'diary-image' }, { type: 'paragraph' }])
        .selectNodeBackward()
        .run();
    },
  },
  {
    title: 'Urbit Link',
    icon: <Sig16Icon className="mr-2 h-4 w-4 text-gray-600" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent([{ type: 'diary-cite' }, { type: 'paragraph' }])
        .selectNodeBackward()
        .run();
    },
  },
  {
    title: 'Code block',
    icon: <CodeIcon className="mr-2 h-4 w-4 text-gray-600" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleCodeBlock()
        .insertContent([{ type: 'paragraph' }])
        .selectNodeBackward()
        .run();
    },
  },
  {
    title: 'Task list',
    icon: <CheckIcon className="mr-2 h-4 w-4 text-gray-600" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleTaskList()
        .insertContent([{ type: 'paragraph' }])
        .selectNodeBackward()
        .run();
    },
  },
];

export const ActionMenuBar = forwardRef<
  any,
  { items: ActionMenuItemProps[]; command: any; highlight: boolean }
>((props, ref) => {
  const { isOpen: leapIsOpen } = useLeap();
  const { items = [], highlight = true } = props;
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
      if (leapIsOpen) return false;
      const len = items.length;
      if (event.key === keyMap.tippy.prevItem) {
        setSelected((s) => (s + 1) % len);
        return true;
      }

      if (event.key === keyMap.tippy.nextItem) {
        setSelected((s) => (s + len - 1) % len);
        return true;
      }

      if (event.key === keyMap.tippy.selectItem) {
        selectItem(selected);
        return true;
      }

      return false;
    },
  }));

  return (
    <ul className="dropdown w-32" ref={ref}>
      {items.map((s: ActionMenuItemProps, idx: number) => (
        <li
          key={s.title}
          onClick={() => selectItem(idx)}
          className={cn(
            'dropdown-item flex',
            selected === idx && highlight ? 'bg-gray-50' : 'bg-white'
          )}
        >
          {s.icon}
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
        allow: ({ editor }) => {
          const anchor = editor.state.selection.$anchor;
          let inList = false;

          for (let i = anchor.depth; i > 0; i -= 1) {
            const node = editor.state.selection.$anchor.node(i);
            if (node.type.name === 'listItem') {
              inList = true;
            }
          }

          return !inList;
        },
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        items: ({ query }: any): ActionMenuItemProps[] => {
          const nedl = query.toLowerCase();

          const hstk = actionMenuItems;
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
              if (props.event.key === keyMap.tippy.close) {
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

export default ActionMenu;
