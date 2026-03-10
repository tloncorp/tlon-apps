import {
  MarkdownTextInput,
  parseExpensiMark,
} from '@expensify/react-native-live-markdown';
import { forwardRef, memo } from 'react';
import type { TextInput, TextInputProps } from 'react-native';

export type LiveMarkdownInputProps = TextInputProps;

export const LiveMarkdownInput = memo(
  forwardRef<TextInput, LiveMarkdownInputProps>(
    ({ multiline = true, ...props }, ref) => {
      return (
        <MarkdownTextInput
          ref={ref}
          {...props}
          multiline={multiline}
          parser={parseExpensiMark}
          autoCapitalize="none"
        />
      );
    }
  )
);

LiveMarkdownInput.displayName = 'LiveMarkdownInput';
