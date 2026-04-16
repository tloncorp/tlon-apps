import { Pressable, Text } from '@tloncorp/ui';
import { ScrollView, TextInput as RNTextInput } from 'react-native';
import { View, XStack, getTokenValue, useTheme } from 'tamagui';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  suggestions: string[];
  suggestionsLabel?: string;
}

export function TextInputWithSuggestions({
  value,
  onChangeText,
  placeholder,
  suggestions,
  suggestionsLabel = 'Suggestions',
}: Props) {
  const theme = useTheme();

  return (
    <View
      borderRadius="$xl"
      borderWidth={1}
      borderColor="$border"
      backgroundColor="$background"
      overflow="hidden"
    >
      <View paddingHorizontal="$l" paddingVertical="$l">
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.tertiaryText.val}
          style={{
            fontSize: 17,
            color: theme.primaryText.val,
          }}
        />
      </View>
      <View height={1} backgroundColor="$border" />
      <View paddingVertical="$m" backgroundColor="$secondaryBackground">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$s" alignItems="center">
            <Text
              size="$label/s"
              color="$tertiaryText"
              flexShrink={0}
              marginLeft="$l"
            >
              {suggestionsLabel}
            </Text>
            {suggestions.map((suggestion, index) => {
              const selected = value === suggestion;
              const isLast = index === suggestions.length - 1;
              return (
                <Pressable
                  key={suggestion}
                  onPress={() => onChangeText(suggestion)}
                  style={isLast ? { marginRight: getTokenValue('$l', 'size') } : undefined}
                >
                  <View
                    paddingHorizontal="$m"
                    paddingVertical="$2xs"
                    borderRadius="$xl"
                    backgroundColor={
                      selected ? '$positiveActionText' : '$background'
                    }
                  >
                    <Text
                      size="$label/s"
                      color={selected ? '$background' : '$secondaryText'}
                    >
                      {suggestion}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </XStack>
        </ScrollView>
      </View>
    </View>
  );
}
