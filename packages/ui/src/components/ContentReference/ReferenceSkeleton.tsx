import { ComponentProps } from 'react';

import { Text, XStack, YStack } from '../../core';
import { PostViewMode } from '../ContentRenderer';
import { Icon } from '../Icon';
import { LoadingSpinner } from '../LoadingSpinner';

export default function ReferenceSkeleton({
  message = 'Loading',
  messageType = 'loading',
  viewMode = 'chat',
  ...props
}: {
  message?: string;
  messageType?: 'loading' | 'error' | 'not-found';
  viewMode?: PostViewMode;
} & ComponentProps<typeof YStack>) {
  return (
    <YStack
      borderRadius="$s"
      padding="$s"
      borderColor="$border"
      borderWidth={viewMode === 'block' ? 0 : 1}
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
