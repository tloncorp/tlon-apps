import type { PersonalityOption } from '@tloncorp/shared/domain';
import { Pressable } from '@tloncorp/ui';
import { Text, View, XStack, YStack } from 'tamagui';

interface Props {
  option: PersonalityOption;
  selected: boolean;
  onPress: () => void;
}

export function PersonalityCard({ option, selected, onPress }: Props) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        padding="$l"
        gap="$m"
        borderRadius="$xl"
        borderWidth={2}
        borderColor={selected ? '$positiveActionText' : '$border'}
        backgroundColor={selected ? '$positiveBackground' : '$secondaryBackground'}
        alignItems="center"
      >
        <View>
          <Text fontSize={28} lineHeight={32}>
            {option.emoji}
          </Text>
        </View>
        <YStack flex={1} gap="$2xs">
          <Text fontSize={16} fontWeight="500" color="$primaryText">
            {option.title}
          </Text>
          <Text fontSize={14} color="$secondaryText">
            {option.description}
          </Text>
        </YStack>
      </XStack>
    </Pressable>
  );
}
