import { Icon, IconButton, Text } from '@tloncorp/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack } from 'tamagui';

import { BucketFileNavigation } from './BucketFileViewer.shared';

export function BucketPreviewControls({
  navigation,
}: {
  navigation?: BucketFileNavigation;
}) {
  const { bottom } = useSafeAreaInsets();
  if (!navigation || navigation.items.length < 2 || navigation.index < 0)
    return null;
  const { index, items, onSelect } = navigation;
  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      gap="$2xl"
      padding="$m"
      paddingBottom={Math.max(bottom, 12)}
      borderTopWidth={1}
      borderTopColor="$border"
      backgroundColor="$background"
    >
      <IconButton
        accessibilityLabel="Previous file"
        aria-label="Previous file"
        role="button"
        testID="BucketPreviousFile"
        disabled={index === 0}
        opacity={index === 0 ? 0.3 : 1}
        onPress={() => onSelect(index - 1)}
      >
        <Icon type="ChevronLeft" />
      </IconButton>
      <Text
        size="$label/m"
        color="$secondaryText"
        accessibilityLiveRegion="polite"
        testID="BucketFilePosition"
      >
        {index + 1} of {items.length}
      </Text>
      <IconButton
        accessibilityLabel="Next file"
        aria-label="Next file"
        role="button"
        testID="BucketNextFile"
        disabled={index === items.length - 1}
        opacity={index === items.length - 1 ? 0.3 : 1}
        onPress={() => onSelect(index + 1)}
      >
        <Icon type="ChevronRight" />
      </IconButton>
    </XStack>
  );
}
