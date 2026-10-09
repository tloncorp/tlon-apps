import { Text } from '@tloncorp/ui';
import { YStack } from 'tamagui';

/** A centered title and hint for a list or search with nothing to show. */
export function ListEmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
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
    </YStack>
  );
}
