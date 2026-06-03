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
          // MarkdownTextInput's ref type is narrower than TextInput; the wrapper
          // exposes the public TextInput ref.
          ref={ref as any}
          {...props}
          multiline={multiline}
          parser={parseExpensiMark}
        />
      );
    }
  )
);

LiveMarkdownInput.displayName = 'LiveMarkdownInput';
