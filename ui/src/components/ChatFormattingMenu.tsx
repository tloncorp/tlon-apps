import { BubbleMenu, Editor } from '@tiptap/react';
import classNames from 'classnames';
import React from 'react';
import BlockQuote from './icons/BlockQuote';
import LinkIcon from './icons/Link';
import Scope from './icons/Scope';

interface ChatFormattingMenuProps {
  editor: Editor;
}

export default function ChatFormattingMenu({
  editor,
}: ChatFormattingMenuProps) {
  return (
    <BubbleMenu editor={editor}>
      <div className="m-2 rounded-md border-2 border-gray-100 bg-white p-3">
        <h2 className="mb-3 text-sm font-semibold text-gray-400">
          Text Formatting
        </h2>
        <div className="flex items-center">
          <button
            className={classNames(
              'icon-button rounded-r-none',
              editor.isActive('bold') && 'bg-blue text-white'
            )}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </button>
          <button
            className={classNames(
              'icon-button rounded-none font-mono italic',
              editor.isActive('italic') && 'bg-blue text-white'
            )}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </button>
          <button
            className={classNames(
              'icon-button rounded-l-none line-through',
              editor.isActive('strike') && 'bg-blue text-white'
            )}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            S
          </button>
          <button
            className="icon-button ml-2 rounded-r-none"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <BlockQuote className="h-3.5 w-3.5" />
          </button>
          <button
            className="icon-button rounded-l-none"
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Scope className="h-3 w-4" />
          </button>
          <button
            className="icon-button ml-2"
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <LinkIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </BubbleMenu>
  );
}
