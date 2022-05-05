import { BubbleMenu, Editor } from '@tiptap/react';
import React, { KeyboardEvent, useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import BlockquoteIcon from '../icons/BlockquoteIcon';
import BoldIcon from '../icons/BoldIcon';
import CodeIcon from '../icons/CodeIcon';
import ItalicIcon from '../icons/ItalicIcon';
import LinkIcon from '../icons/LinkIcon';
import StrikeIcon from '../icons/StrikeIcon';
import XIcon from '../icons/XIcon';
import ChatInputMenuButton from './ChatInputMenuButton';

interface ChatInputMenuProps {
  editor: Editor;
}

interface LinkEditorForm {
  url: string;
}

export default function ChatInputMenu({ editor }: ChatInputMenuProps) {
  const [selected, setSelected] = useState(-1);
  const [editingLink, setEditingLink] = useState(false);
  const options = useMemo(
    () => ['bold', 'italic', 'strike', 'link', 'blockquote', 'code'],
    []
  );
  const { register, handleSubmit } = useForm<LinkEditorForm>();

  const isSelected = useCallback(
    (key: string) => {
      if (selected === -1) {
        return false;
      }

      return options[selected] === key;
    },
    [selected, options]
  );

  const openLinkEditor = useCallback(() => {
    setEditingLink(true);
  }, []);

  const setLink = useCallback(
    ({ url }: LinkEditorForm) => {
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
      } else {
        editor
          .chain()
          .focus()
          .extendMarkRange('link')
          .setLink({ href: url })
          .run();
      }

      setEditingLink(false);
    },
    [editor]
  );

  const closeLinkEditor = useCallback(() => {
    editor.commands.focus();
    setEditingLink(false);
  }, [editor]);

  const onNavigation = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        if (!editingLink) {
          editor.commands.deleteSelection();
          setSelected(-1);
        } else {
          closeLinkEditor();
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
    [selected, options, editingLink, editor, closeLinkEditor]
  );

  return (
    <BubbleMenu editor={editor}>
      <div
        className="default-focus m-2 rounded-md bg-white shadow-lg"
        role="toolbar"
        tabIndex={0}
        aria-label="Text Formatting Menu"
        onKeyDown={onNavigation}
      >
        {editingLink ? (
          <form
            className="input flex min-w-80 items-center space-x-1 p-1 py-1 px-2 leading-4"
            onSubmit={handleSubmit(setLink)}
          >
            <label htmlFor="url" className="sr-only">
              Enter a url
            </label>
            <input
              type="url"
              {...register('url')}
              defaultValue={editor.getAttributes('link').href || ''}
              autoFocus
              placeholder="Enter URL"
              className="flex-1 bg-transparent focus:outline-none"
            />
            <button
              type="submit"
              className="button bg-gray-100 py-0.5 px-1.5 text-sm leading-4 text-gray-600 hover:bg-gray-200"
            >
              save
            </button>
            <button
              type="button"
              className="icon-button bg h-5 w-5"
              onClick={closeLinkEditor}
            >
              <XIcon className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <div className="flex items-center space-x-1 p-1">
            <ChatInputMenuButton
              isActive={editor.isActive('bold')}
              isSelected={isSelected('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
              unpressedLabel="Apply Bold"
              pressedLabel="Remove Bold"
            >
              <BoldIcon className="h-6 w-6" />
            </ChatInputMenuButton>
            <ChatInputMenuButton
              isActive={editor.isActive('italic')}
              isSelected={isSelected('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              unpressedLabel={'Apply Italic'}
              pressedLabel={'Remove Italic'}
            >
              <ItalicIcon className="h-6 w-6" />
            </ChatInputMenuButton>
            <ChatInputMenuButton
              isActive={editor.isActive('strike')}
              isSelected={isSelected('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
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
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              unpressedLabel="Apply Blockquote"
              pressedLabel="Remove Blockquote"
            >
              <BlockquoteIcon className="h-6 w-6" />
            </ChatInputMenuButton>
            <ChatInputMenuButton
              isActive={editor.isActive('code')}
              isSelected={isSelected('code')}
              onClick={() => editor.chain().focus().toggleCode().run()}
              unpressedLabel="Apply Code"
              pressedLabel="Remove Code"
            >
              <CodeIcon className="h-6 w-6" />
            </ChatInputMenuButton>
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
