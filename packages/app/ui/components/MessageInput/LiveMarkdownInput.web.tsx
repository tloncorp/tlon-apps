import { forwardRef, memo } from 'react';
import type { TextInputProps } from 'react-native';
import { TextArea } from 'tamagui';

export type LiveMarkdownInputProps = TextInputProps;

export const LiveMarkdownInput = memo(
  forwardRef<any, LiveMarkdownInputProps>(
    ({ value, onChangeText, placeholder, style, multiline }, ref) => {
      // Web fallback (live-markdown is native-only). Only forward the props
      // Tamagui's TextArea understands — spreading raw TextInputProps conflicts.
      return (
        <TextArea
          ref={ref}
          value={value as string}
          onChangeText={onChangeText}
          placeholder={placeholder}
          style={style as any}
          multiline={multiline}
          borderWidth={0}
          outlineWidth={0}
          padding={0}
        />
      );
    }
  )
);

LiveMarkdownInput.displayName = 'LiveMarkdownInput';
