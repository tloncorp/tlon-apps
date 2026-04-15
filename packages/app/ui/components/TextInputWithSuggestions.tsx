import { Pressable } from '@tloncorp/ui';
import { useMemo } from 'react';
import { TextInput as RNTextInput, ScrollView } from 'react-native';
import { SizableText, Text, View, XStack, useThemeName } from 'tamagui';

const VISIBLE_COUNT = 8;

function pickRandom(items: string[], count: number): string[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

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
  const visibleSuggestions = useMemo(
    () =>
      suggestions.length > VISIBLE_COUNT
        ? pickRandom(suggestions, VISIBLE_COUNT)
        : suggestions,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions.length]
  );
  const theme = useThemeName();
  const textColor = theme === 'dark' ? '#ffffff' : '#1a1818';
  const placeholderColor = theme === 'dark' ? '#808080' : '#999999';

  return (
    <View
      borderRadius="$xl"
      borderWidth={1}
      borderColor="$border"
      backgroundColor="$background"
      overflow="hidden"
    >
      <View paddingHorizontal="$l" paddingVertical="$xl">
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          style={{
            fontSize: 16,
            color: textColor,
          }}
        />
      </View>
      <View height={1} backgroundColor="$border" />
      <View paddingVertical="$m" backgroundColor="$secondaryBackground">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$s" alignItems="center">
            <Text
              fontSize={14}
              color="$tertiaryText"
              flexShrink={0}
              marginLeft="$l"
            >
              {suggestionsLabel}
            </Text>
            {visibleSuggestions.map((suggestion, index) => {
              const selected = value === suggestion;
              const isLast = index === visibleSuggestions.length - 1;
              return (
                <Pressable
                  key={suggestion}
                  onPress={() => onChangeText(suggestion)}
                  style={isLast ? { marginRight: 12 } : undefined}
                >
                  <View
                    paddingHorizontal="$m"
                    paddingVertical="$2xs"
                    borderRadius="$xl"
                    backgroundColor={
                      selected ? '$positiveActionText' : '$background'
                    }
                  >
                    <SizableText
                      size="$s"
                      color={selected ? '$background' : '$secondaryText'}
                    >
                      {suggestion}
                    </SizableText>
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
