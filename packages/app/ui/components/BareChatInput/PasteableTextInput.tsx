import {
  type ForwardRefExoticComponent,
  type RefAttributes,
  forwardRef,
} from 'react';
import { TextInput, type TextInputInstance } from 'react-native';

import { PasteableTextInputProps } from './PasteableTextInput.shared';

// Annotated because React Native's input instance class is not exported, so
// an inferred type here could not be named in the emitted declarations.
export const PasteableTextInput: ForwardRefExoticComponent<
  PasteableTextInputProps & RefAttributes<TextInputInstance>
> = forwardRef<TextInputInstance, PasteableTextInputProps>(
  function PasteableTextInput({ onPasteFiles: _onPasteFiles, ...props }, ref) {
    // Web handles image paste via the document-level usePasteHandler in
    // BareChatInput, so onPasteFiles is intentionally unused here.
    return <TextInput ref={ref} {...props} />;
  }
);
