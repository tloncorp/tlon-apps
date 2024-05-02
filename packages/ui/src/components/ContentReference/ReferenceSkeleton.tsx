import { Text, XStack, YStack } from '../../core';
import { Icon } from '../Icon';
import { LoadingSpinner } from '../LoadingSpinner';

export default function ReferenceSkeleton({
  message = 'Loading',
  messageType = 'loading',
}: {
  message?: string;
  messageType?: 'loading' | 'error' | 'not-found';
}) {
  return (
    <YStack
      borderRadius="$s"
      padding="$s"
      borderColor="$border"
      borderWidth={1}
    >
      <XStack
        alignItems="center"
        paddingBottom="$s"
        justifyContent="space-between"
      >
        <XStack padding="$l" gap="$l" alignItems="center">
          {messageType === 'loading' ? (
            <LoadingSpinner />
          ) : (
            // TODO: Replace with proper error icon when available
            <Icon type="Placeholder" color="$tertiaryText" size="$l" />
          )}
          <Text fontSize="$l" color="$tertiaryText" flex={1}>
            {message}
          </Text>
          <Icon type="ArrowRef" color="$tertiaryText" size="$m" />
        </XStack>
      </XStack>
    </YStack>
  );
}
