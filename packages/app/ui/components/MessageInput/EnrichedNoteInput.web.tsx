import { forwardRef, memo } from 'react';
import { TextArea } from 'tamagui';

import type { EnrichedNoteInputProps, EnrichedNoteInputRef } from './EnrichedNoteInput';

/**
 * Web fallback — react-native-enriched is native-only.
 * Renders a plain TextArea since react-native-enriched is native-only.
 */
export const EnrichedNoteInput = memo(
  forwardRef<EnrichedNoteInputRef, EnrichedNoteInputProps>(
    ({ initialHtml, onChangeHtml, onEditorStateChange: _onEditorStateChange, onPasteImages: _onPasteImages, placeholder, testID, style }, ref) => {
      return (
        <TextArea
          testID={testID}
          defaultValue={initialHtml}
          onChangeText={onChangeHtml}
          placeholder={placeholder}
          style={style as any}
          borderWidth={0}
          outlineWidth={0}
          padding={0}
        />
      );
    }
  )
);

EnrichedNoteInput.displayName = 'EnrichedNoteInput';
