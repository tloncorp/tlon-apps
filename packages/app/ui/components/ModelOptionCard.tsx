import type { ModelOption } from '@tloncorp/shared/domain';
import { Icon, Pressable } from '@tloncorp/ui';
import { Text, XStack, YStack } from 'tamagui';

interface Props {
  option: ModelOption;
  selected: boolean;
  onPress: () => void;
}

export function ModelOptionCard({ option, selected, onPress }: Props) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        padding="$l"
        borderRadius="$xl"
        borderWidth={2}
        borderColor={selected ? '$positiveActionText' : '$border'}
        backgroundColor={
          selected ? '$positiveBackground' : '$secondaryBackground'
        }
        justifyContent="space-between"
        alignItems="center"
      >
        <YStack>
          <Text
            fontSize={16}
            fontWeight="500"
            color={selected ? '$positiveActionText' : '$primaryText'}
          >
            {option.label}
          </Text>
          <Text
            fontSize={12}
            color={selected ? '$positiveActionText' : '$secondaryText'}
          >
            {option.description}
          </Text>
        </YStack>
        {selected && <Icon type="Checkmark" color="$positiveActionText" />}
      </XStack>
    </Pressable>
  );
}
