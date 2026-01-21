import { ComponentProps, useCallback } from 'react';
import { TextArea } from 'tamagui';

export interface MarkdownEditorProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  testID?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your content in Markdown...',
  testID,
}: MarkdownEditorProps) {
  const handleChangeText = useCallback(
    (text: string) => {
      onChange(text);
    },
    [onChange]
  );

  return (
    <TextArea
      flex={1}
      width="100%"
      fontFamily="$mono"
      fontSize="$m"
      color="$primaryText"
      backgroundColor="$background"
      borderWidth={0}
      borderColor="transparent"
      paddingHorizontal="$l"
      paddingVertical="$m"
      value={value}
      onChangeText={handleChangeText}
      placeholder={placeholder}
      placeholderTextColor="$tertiaryText"
      testID={testID}
    />
  );
}
