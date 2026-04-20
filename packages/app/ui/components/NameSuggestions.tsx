import { SUGGESTED_NAMES } from '@tloncorp/shared/domain';
import { Pressable } from '@tloncorp/ui';
import { ScrollView, Text, XStack } from 'tamagui';

interface Props {
  onSelect: (name: string) => void;
  currentValue: string;
}

export function NameSuggestions({ onSelect, currentValue }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <XStack gap="$s" alignItems="center">
        <Text fontSize={14} color="$tertiaryText" flexShrink={0} marginLeft="$l">
          Suggestions
        </Text>
        {SUGGESTED_NAMES.map((name) => (
          <Pressable key={name} onPress={() => onSelect(name)}>
            <XStack
              paddingHorizontal="$m"
              paddingVertical="$s"
              borderRadius="$3xl"
              backgroundColor={
                currentValue === name
                  ? '$positiveActionText'
                  : '$border'
              }
            >
              <Text
                fontSize={14}
                color={currentValue === name ? 'white' : '$primaryText'}
              >
                {name}
              </Text>
            </XStack>
          </Pressable>
        ))}
      </XStack>
    </ScrollView>
  );
}
