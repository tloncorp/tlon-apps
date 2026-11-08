import {
  type ComponentPropsWithoutRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
  forwardRef,
} from 'react';
import type { TextInputInstance } from 'react-native';
import { TextArea as TamaguiTextArea } from 'tamagui';

import type { PastedFile } from '../BareChatInput/pastedImage';

// Tamagui types this native ref as the View component instead of the input instance.
const TextArea = TamaguiTextArea as ForwardRefExoticComponent<
  ComponentPropsWithoutRef<typeof TamaguiTextArea> &
    RefAttributes<Pick<TextInputInstance, 'focus'>>
>;

export type NoteBodyTextAreaProps = ComponentPropsWithoutRef<
  typeof TextArea
> & {
  // Native only: web reads pasted images from the textarea's paste event.
  onPasteFiles?: (files: PastedFile[]) => void;
};

export const NoteBodyTextArea: ForwardRefExoticComponent<
  NoteBodyTextAreaProps & RefAttributes<Pick<TextInputInstance, 'focus'>>
> = forwardRef<Pick<TextInputInstance, 'focus'>, NoteBodyTextAreaProps>(
  function NoteBodyTextArea({ onPasteFiles: _onPasteFiles, ...props }, ref) {
    return <TextArea ref={ref} {...props} />;
  }
);
