import { useCallback } from 'react';
import { Dimensions } from 'react-native';
import { TextArea } from 'tamagui';

const WINDOW_HEIGHT = Dimensions.get('window').height;

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
      minHeight={WINDOW_HEIGHT * 0.75}
      fontFamily="$mono"
      fontSize="$m"
      color="$primaryText"
      backgroundColor="$background"
      borderWidth={0}
      borderColor="transparent"
      outlineWidth={0}
      outlineColor="transparent"
      focusStyle={{
        borderWidth: 0,
        borderColor: 'transparent',
        outlineWidth: 0,
        outlineColor: 'transparent',
      }}
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
