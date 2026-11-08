import type { ComponentPropsWithoutRef } from 'react';
import type { TextArea } from 'tamagui';

import type { PastedFile } from '../BareChatInput/pastedImage';

export type NoteBodyTextAreaProps = ComponentPropsWithoutRef<
  typeof TextArea
> & {
  // Native only: web reads pasted images from the textarea's paste event.
  onPasteFiles?: (files: PastedFile[]) => void;
};
