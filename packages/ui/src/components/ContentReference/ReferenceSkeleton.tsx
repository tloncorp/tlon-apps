import { ComponentProps } from 'react';

import { Text, XStack, YStack } from '../../core';
import { Icon } from '../Icon';
import { LoadingSpinner } from '../LoadingSpinner';

export default function ReferenceSkeleton({
  message = 'Loading',
  messageType = 'loading',
  ...props
}: {
  message?: string;
  messageType?: 'loading' | 'error' | 'not-found';
} & ComponentProps<typeof YStack>) {
  return (
    <YStack
      borderRadius="$s"
      padding="$s"
      borderColor="$border"
      borderWidth={1}
      {...props}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <XStack padding="$m" gap="$m" alignItems="center">
          {messageType === 'loading' ? (
            <LoadingSpinner />
          ) : (
            // TODO: Replace with proper error icon when available
            <Icon type="Placeholder" color="$tertiaryText" size="$l" />
          )}
          <Text fontSize="$s" color="$tertiaryText" flex={1}>
            {message}
          </Text>
        </XStack>
      </XStack>
    </YStack>
  );
}
