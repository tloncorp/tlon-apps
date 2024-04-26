import { Text, XStack, YStack } from '../../core';
import { Icon } from '../Icon';
import { LoadingSpinner } from '../LoadingSpinner';

export default function ReferenceSkeleton() {
  return (
    <YStack
      borderRadius="$s"
      padding="$s"
      marginBottom="$s"
      borderColor="$border"
      borderWidth={1}
    >
      <XStack
        alignItems="center"
        paddingBottom="$s"
        justifyContent="space-between"
      >
        <XStack padding="$l" gap="$l" alignItems="center">
          <LoadingSpinner />
          <Text fontSize="$l" color="$tertiaryText">Loading</Text>
        </XStack>
        <Icon type="ArrowRef" color="$tertiaryText" size="$m" />
      </XStack>
    </YStack>
  );
}
