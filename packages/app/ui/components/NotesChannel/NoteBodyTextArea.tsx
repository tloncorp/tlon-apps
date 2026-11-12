import {
  type ComponentPropsWithoutRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
  forwardRef,
} from 'react';
import type { TextInputInstance } from 'react-native';
import { TextArea as TamaguiTextArea } from 'tamagui';

import type { NoteBodyTextAreaProps } from './NoteBodyTextArea.shared';

// Tamagui types this native ref as the View component instead of the input instance.
const TextArea = TamaguiTextArea as ForwardRefExoticComponent<
  ComponentPropsWithoutRef<typeof TamaguiTextArea> &
    RefAttributes<Pick<TextInputInstance, 'focus'>>
>;

export const NoteBodyTextArea: ForwardRefExoticComponent<
  NoteBodyTextAreaProps & RefAttributes<Pick<TextInputInstance, 'focus'>>
> = forwardRef<Pick<TextInputInstance, 'focus'>, NoteBodyTextAreaProps>(
  function NoteBodyTextArea(
    {
      onPasteFiles: _onPasteFiles,
      onPasteFailed: _onPasteFailed,
      menuItems: _menuItems,
      onMenuItemPress: _onMenuItemPress,
      caretRequest: _caretRequest,
      ...props
    },
    ref
  ) {
    return <TextArea ref={ref} {...props} />;
  }
);
