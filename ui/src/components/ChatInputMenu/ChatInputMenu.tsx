import { BubbleMenu, Editor } from '@tiptap/react';
import classNames from 'classnames';
import React, { KeyboardEvent, useCallback, useMemo, useState } from 'react';
import BlockquoteIcon from '../icons/BlockquoteIcon';
import BoldIcon from '../icons/BoldIcon';
import CodeIcon from '../icons/CodeIcon';
import ItalicIcon from '../icons/ItalicIcon';
import LinkIcon from '../icons/LinkIcon';
import StrikeIcon from '../icons/StrikeIcon';
import ChatInputMenuButton from './ChatInputMenuButton';

interface ChatInputMenuProps {
  editor: Editor;
}

export default function ChatInputMenu({ editor }: ChatInputMenuProps) {
  const [selected, setSelected] = useState(-1);
  const options = useMemo(
    () => ['bold', 'italic', 'strike', 'link', 'blockquote', 'code'],
    []
  );

  const isSelected = useCallback(
    (key: string) => {
      if (selected === -1) {
        return false;
      }

      return options[selected] === key;
    },
    [selected, options]
  );

  const onNavigation = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        editor.commands.deleteSelection();
        setSelected(-1);
      }

      const total = options.length;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        setSelected((total + selected + 1) % total);
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        setSelected((total + selected - 1) % total);
      }
    },
    [selected, options, editor]
  );

  return (
    <BubbleMenu editor={editor}>
      <div
        className="default-focus m-2 flex items-center space-x-1 rounded-md bg-white p-1 shadow-lg"
        role="toolbar"
        tabIndex={0}
        aria-label="Text Formatting Menu"
        onKeyDown={onNavigation}
      >
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
          onClick={() => editor.chain().focus().toggleCode().run()}
          unpressedLabel="Add Link"
          pressedLabel="Remove Link"
        >
          <span className="sr-only">Convert to Link</span>
          <LinkIcon className="h-5 w-5" />
        </ChatInputMenuButton>
        <ChatInputMenuButton
          isActive={editor.isActive('blockquote')}
          isSelected={isSelected('blockqoute')}
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
    </BubbleMenu>
  );
}
