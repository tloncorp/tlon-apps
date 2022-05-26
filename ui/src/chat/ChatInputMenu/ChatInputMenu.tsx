import {
  Editor,
  isNodeSelection,
  isTextSelection,
  posToDOMRect,
} from '@tiptap/react';
import { Editor as CoreEditor } from '@tiptap/core';
import * as Popover from '@radix-ui/react-popover';
import React, {
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import isURL from 'validator/es/lib/isURL';
import { useForm } from 'react-hook-form';
import BlockquoteIcon from '../../components/icons/BlockquoteIcon';
import BoldIcon from '../../components/icons/BoldIcon';
import CodeIcon from '../../components/icons/CodeIcon';
import ItalicIcon from '../../components/icons/ItalicIcon';
import LinkIcon from '../../components/icons/LinkIcon';
import StrikeIcon from '../../components/icons/StrikeIcon';
import ChatInputMenuButton from './ChatInputMenuButton';

interface ChatInputMenuProps {
  editor: Editor;
}

interface LinkEditorForm {
  url: string;
}

type MenuState = 'closed' | 'open' | 'editing-link' | 'link-hover';

const options = ['bold', 'italic', 'strike', 'link', 'blockquote', 'code'];

export default function ChatInputMenu({ editor }: ChatInputMenuProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(-1);
  const [selectionPos, setSelectionPos] = useState<DOMRect>();
  const [status, setStatus] = useState<MenuState>('closed');
  const { register, handleSubmit, formState } = useForm<LinkEditorForm>({
    mode: 'onChange',
  });

  const onSelection = useCallback(
    ({ editor: currentEditor }: { editor: CoreEditor }) => {
      setSelected(-1);
      const { view } = currentEditor;
      const { doc, selection } = currentEditor.state;
      const { empty, ranges } = selection;

      // Sometime check for `empty` is not enough.
      // Doubleclick an empty paragraph returns a node size of 2.
      // So we check also for an empty text size.
      const from = Math.min(...ranges.map((range) => range.$from.pos));
      const to = Math.max(...ranges.map((range) => range.$to.pos));
      const isEmptyTextBlock =
        !doc.textBetween(from, to).length && isTextSelection(selection);

      if (!view.hasFocus() || empty || isEmptyTextBlock) {
        setStatus('closed');
        return;
      }

      if (isNodeSelection(selection)) {
        const node = view.nodeDOM(from) as HTMLElement;

        if (node) {
          setSelectionPos(node.getBoundingClientRect());
        }
      } else {
        setSelectionPos(posToDOMRect(view, from, to));
      }

      setStatus('open');
    },
    []
  );

  useEffect(() => {
    editor.on('selectionUpdate', onSelection);

    return () => {
      editor.off('selectionUpdate', onSelection);
    };
  }, [editor, onSelection]);

  const isSelected = useCallback(
    (key: string) => {
      if (selected === -1) {
        return false;
      }

      return options[selected] === key;
    },
    [selected]
  );

  const openLinkEditor = useCallback(() => {
    setStatus('editing-link');
  }, []);

  const setLink = useCallback(
    ({ url }: LinkEditorForm) => {
      if (url === '') {
        editor.chain().extendMarkRange('link').unsetLink().run();
      } else {
        editor.chain().extendMarkRange('link').setLink({ href: url }).run();
      }

      setStatus('open');
    },
    [editor]
  );

  const onNavigation = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        if (status === 'open') {
          setStatus('closed');
          setSelected(-1);
          editor
            .chain()
            .setTextSelection(editor.state.selection.from)
            .focus()
            .run();
        } else {
          setStatus('open');
          toolbarRef.current?.focus();
        }
      }

      const total = options.length;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        setSelected((total + selected + 1) % total);
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        setSelected((total + selected - 1) % total);
      }
    },
    [selected, status, editor]
  );

  return (
    <Popover.Root open={status !== 'closed'}>
      <Popover.Anchor
        className="pointer-events-none fixed"
        style={{
          width: selectionPos?.width,
          height: selectionPos?.height,
          top: selectionPos?.top,
          left: selectionPos?.left,
        }}
      />
      <Popover.Content
        side="top"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDownOutside={() => setStatus('closed')}
      >
        <div
          ref={toolbarRef}
          className="default-focus rounded-lg bg-white shadow-lg dark:border dark:border-black/10"
          role="toolbar"
          tabIndex={0}
          aria-label="Text Formatting Menu"
          onKeyDown={onNavigation}
        >
          {status === 'editing-link' ? (
            <form
              className="input flex min-w-80 items-center p-0 leading-4"
              onSubmit={handleSubmit(setLink)}
            >
              <label htmlFor="url" className="sr-only">
                Enter a url
              </label>
              <input
                type="text"
                {...register('url', {
                  validate: (value) => value === '' || isURL(value),
                })}
                defaultValue={editor.getAttributes('link').href || ''}
                autoFocus
                placeholder="Enter URL"
                className="input-inner flex-1 focus:outline-none"
              />
              <button
                type="submit"
                className="button ml-1 bg-transparent py-0.5 px-1.5 text-sm font-medium leading-4 text-gray-800 hover:bg-transparent hover:ring-2 disabled:bg-transparent disabled:text-gray-400"
                disabled={!formState.isValid}
              >
                Done
              </button>
            </form>
          ) : (
            <div className="flex items-center space-x-1 p-1">
              <ChatInputMenuButton
                isActive={editor.isActive('bold')}
                isSelected={isSelected('bold')}
                onClick={() => editor.chain().toggleBold().run()}
                unpressedLabel="Apply Bold"
                pressedLabel="Remove Bold"
              >
                <BoldIcon className="h-6 w-6" />
              </ChatInputMenuButton>
              <ChatInputMenuButton
                isActive={editor.isActive('italic')}
                isSelected={isSelected('italic')}
                onClick={() => editor.chain().toggleItalic().run()}
                unpressedLabel={'Apply Italic'}
                pressedLabel={'Remove Italic'}
              >
                <ItalicIcon className="h-6 w-6" />
              </ChatInputMenuButton>
              <ChatInputMenuButton
                isActive={editor.isActive('strike')}
                isSelected={isSelected('strike')}
                onClick={() => editor.chain().toggleStrike().run()}
                unpressedLabel="Apply Strikethrough"
                pressedLabel="Remove Strikethrough"
              >
                <StrikeIcon className="h-6 w-6" />
              </ChatInputMenuButton>
              <ChatInputMenuButton
                isActive={editor.isActive('link')}
                isSelected={isSelected('link')}
                onClick={openLinkEditor}
                unpressedLabel="Add Link"
                pressedLabel="Remove Link"
              >
                <span className="sr-only">Convert to Link</span>
                <LinkIcon className="h-5 w-5" />
              </ChatInputMenuButton>
              <ChatInputMenuButton
                isActive={editor.isActive('blockquote')}
                isSelected={isSelected('blockquote')}
                onClick={() => editor.chain().toggleBlockquote().run()}
                unpressedLabel="Apply Blockquote"
                pressedLabel="Remove Blockquote"
              >
                <BlockquoteIcon className="h-6 w-6" />
              </ChatInputMenuButton>
              <ChatInputMenuButton
                isActive={editor.isActive('code')}
                isSelected={isSelected('code')}
                onClick={() => editor.chain().toggleCode().run()}
                unpressedLabel="Apply Code"
                pressedLabel="Remove Code"
              >
                <CodeIcon className="h-6 w-6" />
              </ChatInputMenuButton>
            </div>
          )}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
