import PasteInput, {
  PastedFile as NativePastedFile,
} from '@mattermost/react-native-paste-input';
import { forwardRef } from 'react';
import { TextInput } from 'react-native';

import { PasteableTextInputProps } from './PasteableTextInput.shared';

export const PasteableTextInput = forwardRef<
  TextInput,
  PasteableTextInputProps
>(function PasteableTextInput({ onPasteFiles, ...props }, ref) {
  return (
    <PasteInput
      ref={ref}
      {...props}
      onPaste={(
        error: string | null | undefined,
        files: NativePastedFile[]
      ) => {
        if (error) {
          return;
        }
        onPasteFiles?.(files);
      }}
    />
  );
});
