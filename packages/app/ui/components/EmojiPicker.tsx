import { SUGGESTED_EMOJIS } from '@tloncorp/shared/domain';
import { Pressable } from '@tloncorp/ui';
import { Text, View, XStack, YStack } from 'tamagui';

import { Field } from './Form';

interface Props {
  value: string;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ value, onSelect }: Props) {
  return (
    <Field label="Emoji">
      <YStack gap="$m">
        <View
          flexDirection="row"
          flexWrap="wrap"
          gap="$s"
        >
          {SUGGESTED_EMOJIS.map((emoji) => (
            <Pressable key={emoji} onPress={() => onSelect(emoji)}>
              <View
                width={48}
                height={48}
                borderRadius="$m"
                borderWidth={2}
                borderColor={value === emoji ? '$positiveActionText' : '$border'}
                backgroundColor={
                  value === emoji ? '$positiveBackground' : '$secondaryBackground'
                }
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={24}>{emoji}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        <XStack gap="$s" alignItems="center">
          <Text fontSize={14} color="$secondaryText">
            Selected:
          </Text>
          <Text fontSize={24}>{value}</Text>
        </XStack>
      </YStack>
    </Field>
  );
}
