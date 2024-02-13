import ChatInputMenuButton from '@/chat/ChatInputMenu/ChatInputMenuButton';
import BlockquoteIcon from '@/components/icons/BlockquoteIcon';
import BoldIcon from '@/components/icons/BoldIcon';
import CaretRightIcon from '@/components/icons/CaretRightIcon';
import CodeBlockIcon from '@/components/icons/CodeBlockIcon';
import CodeIcon from '@/components/icons/CodeIcon';
import ItalicIcon from '@/components/icons/ItalicIcon';
import LinkIcon from '@/components/icons/LinkIcon';
import StrikeIcon from '@/components/icons/StrikeIcon';
import X16Icon from '@/components/icons/X16Icon';
import { useIsMobile } from '@/logic/useMedia';
import { Editor as CoreEditor } from '@tiptap/core';
import React, { KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import isURL from 'validator/es/lib/isURL';

export type MenuState = 'closed' | 'open' | 'editing-link' | 'link-hover';

export interface LinkEditorForm {
  url: string;
}

interface ChatInputMenuToolbarProps {
  editor: CoreEditor;
  toolbarRef: React.RefObject<HTMLDivElement>;
  status: MenuState;
  setStatus: React.Dispatch<React.SetStateAction<MenuState>>;
  setLink: ({ url }: LinkEditorForm) => void;
  onNavigation: (event: KeyboardEvent<HTMLDivElement>) => void;
  isSelected: (key: string) => boolean;
  openLinkEditor: () => void;
}

export default function ChatInputMenuToolbar({
  editor,
  toolbarRef,
  status,
  setStatus,
  setLink,
  onNavigation,
  isSelected,
  openLinkEditor,
}: ChatInputMenuToolbarProps) {
  const { register, handleSubmit, formState } = useForm<LinkEditorForm>({
    mode: 'onChange',
  });
  const isMobile = useIsMobile();

  const toolbarClassNames = isMobile
    ? 'mt-2'
    : 'default-focus rounded-lg bg-white shadow-xl dark:border dark:border-black/10 w-full';

  return (
    <div
      ref={toolbarRef}
      className={toolbarClassNames}
      role="toolbar"
      tabIndex={0}
      aria-label="Text Formatting Menu"
      onKeyDown={onNavigation}
    >
      {status === 'editing-link' ? (
        <div className="flex items-center">
          <form
            className="input flex grow items-center p-0 leading-4"
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
              className="button ml-1 bg-transparent px-1.5 py-0.5 text-sm font-medium leading-4 text-gray-800 hover:bg-transparent hover:ring-2 disabled:bg-transparent disabled:text-gray-400"
              disabled={!formState.isValid}
            >
              Done
            </button>
          </form>
          {isMobile && (
            <button
              className="icon-button ml-2 h-8 w-8"
              onClick={() => setStatus('open')}
            >
              <X16Icon className="h-6 w-6" />
            </button>
          )}
        </div>
      ) : (
        <div
          className={`items center flex space-x-1  ${
            isMobile ? 'justify-between' : 'p-1'
          }`}
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
            onClick={openLinkEditor}
            unpressedLabel="Add Link"
            pressedLabel="Remove Link"
          >
            <span className="sr-only">Convert to Link</span>
            <LinkIcon className="h-5 w-5" />
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
          <ChatInputMenuButton
            className="!ml-4"
            isActive={editor.isActive('blockquote')}
            isSelected={isSelected('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            unpressedLabel="Apply Blockquote"
            pressedLabel="Remove Blockquote"
          >
            <BlockquoteIcon className="h-6 w-6" />
          </ChatInputMenuButton>
          <ChatInputMenuButton
            isActive={editor.isActive('codeBlock')}
            isSelected={isSelected('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            unpressedLabel="Apply Code Block"
            pressedLabel="Remove Code Block"
          >
            <CodeBlockIcon className="h-6 w-6" />
          </ChatInputMenuButton>
          <ChatInputMenuButton
            textButton
            onClick={() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            }
            unpressedLabel="Remove All Formatting"
            pressedLabel="Remove All Formatting"
          >
            Clear
          </ChatInputMenuButton>
        </div>
      )}
    </div>
  );
}
