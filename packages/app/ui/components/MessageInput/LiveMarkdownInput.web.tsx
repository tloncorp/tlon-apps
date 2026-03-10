import { forwardRef, memo } from 'react';
import type { TextInputProps } from 'react-native';
import { TextArea } from 'tamagui';

export type LiveMarkdownInputProps = TextInputProps;

export const LiveMarkdownInput = memo(
  forwardRef<any, LiveMarkdownInputProps>(
    ({ value, onChangeText, placeholder, style, ...props }, ref) => {
    return (
      <TextArea
        ref={ref}
        {...props}
        value={value as string}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={style as any}
        borderWidth={0}
        outlineWidth={0}
        padding={0}
      />
    );
  })
);

LiveMarkdownInput.displayName = 'LiveMarkdownInput';
