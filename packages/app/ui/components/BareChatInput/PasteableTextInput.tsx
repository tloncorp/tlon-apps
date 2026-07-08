import { forwardRef } from 'react';
import { TextInput } from 'react-native';

import { PasteableTextInputProps } from './PasteableTextInput.shared';

export const PasteableTextInput = forwardRef<TextInput, PasteableTextInputProps>(
  function PasteableTextInput({ onPasteFiles: _onPasteFiles, ...props }, ref) {
    // Web handles image paste via the document-level usePasteHandler in
    // BareChatInput, so onPasteFiles is intentionally unused here.
    return <TextInput ref={ref} {...props} />;
  }
);
