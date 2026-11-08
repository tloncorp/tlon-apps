import {
  type ForwardRefExoticComponent,
  type Ref,
  type RefAttributes,
  forwardRef,
} from 'react';
import type { TextInputInstance } from 'react-native';
import { Text, styled } from 'tamagui';

import { PasteableTextInput } from '../BareChatInput/PasteableTextInput';
import type { NoteBodyTextAreaProps } from './NoteBodyTextArea.shared';

// Tamagui's TextArea is bound to RN's TextInput, which drops images from the
// system Paste menu. This is the same styled input on the paste input chat uses.
const StyledPasteableTextInput = styled(
  PasteableTextInput,
  { name: 'NoteBodyTextArea', minWidth: 0 },
  {
    isInput: true,
    accept: { placeholderTextColor: 'color' } as const,
    validStyles: Text.staticConfig.validStyles,
  }
);

export const NoteBodyTextArea: ForwardRefExoticComponent<
  NoteBodyTextAreaProps & RefAttributes<Pick<TextInputInstance, 'focus'>>
> = forwardRef<Pick<TextInputInstance, 'focus'>, NoteBodyTextAreaProps>(
  function NoteBodyTextArea(
    { disabled, focusVisibleStyle: _focusVisibleStyle, ...props },
    ref
  ) {
    return (
      <StyledPasteableTextInput
        // The shared props type only promises focus(); the instance is a full input.
        ref={ref as Ref<TextInputInstance>}
        multiline
        editable={!disabled}
        // The shared props are typed against the web TextArea's DOM handlers.
        {...(props as object)}
      />
    );
  }
);
