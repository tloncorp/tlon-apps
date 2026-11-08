import type { ComponentPropsWithoutRef } from 'react';
import type { TextArea } from 'tamagui';

import type { PastedFile } from '../BareChatInput/pastedImage';

export type NoteBodyMenuItem = { id: string; title: string };
export type NoteBodyCaretRequest = { caret: number; id: number };

export type NoteBodyTextAreaProps = ComponentPropsWithoutRef<
  typeof TextArea
> & {
  // Native only. Web reads pasted images from the textarea's paste event,
  // places the caret itself, and keeps the browser's own context menu.
  onPasteFiles?: (files: PastedFile[]) => void;
  onPasteFailed?: () => void;
  menuItems?: NoteBodyMenuItem[];
  onMenuItemPress?: (id: string) => void;
  caretRequest?: NoteBodyCaretRequest | null;
};
