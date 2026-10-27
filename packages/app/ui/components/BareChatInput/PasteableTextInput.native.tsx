import NativePasteInput, {
  PastedFile as NativePastedFile,
} from '@mattermost/react-native-paste-input';
import {
  type ComponentPropsWithoutRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
  forwardRef,
} from 'react';
import { TextInputInstance } from 'react-native';

import { PasteableTextInputProps } from './PasteableTextInput.shared';

// PasteInput still declares its ref as the old RN TextInput component type.
const PasteInput = NativePasteInput as ForwardRefExoticComponent<
  ComponentPropsWithoutRef<typeof NativePasteInput> &
    RefAttributes<TextInputInstance>
>;

// Annotated because React Native's input instance class is not exported, so
// an inferred type here could not be named in the emitted declarations.
export const PasteableTextInput: ForwardRefExoticComponent<
  PasteableTextInputProps & RefAttributes<TextInputInstance>
> = forwardRef<TextInputInstance, PasteableTextInputProps>(
  function PasteableTextInput({ onPasteFiles, ...props }, ref) {
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
  }
);
