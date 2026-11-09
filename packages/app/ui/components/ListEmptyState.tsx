import { Text } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import { YStack } from 'tamagui';

/**
 * A centered title and hint for a list or search with nothing to show, with
 * optional actions beneath.
 */
export function ListEmptyState({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <YStack
      alignItems="center"
      gap="$s"
      paddingHorizontal="$2xl"
      paddingVertical="$4xl"
    >
      <Text size="$label/l" color="$secondaryText">
        {title}
      </Text>
      <Text size="$label/m" color="$tertiaryText" textAlign="center">
        {subtitle}
      </Text>
      {children}
    </YStack>
  );
}
