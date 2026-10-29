import { Icon, Pressable, Text } from '@tloncorp/ui';
import { XStack } from 'tamagui';

import { floatingPinnedPostBannerHeight } from '../conversationInsets';

/**
 * The bar above an HTML preview whose page has scripts while they are held
 * (htmlPreviewHeldPolicy), shaped like a channel's pinned post banner but set
 * apart in the positive tint, with the reader's way to let them run.
 */
export function BucketFileViewerScriptsBanner({
  onEnable,
}: {
  onEnable: () => void;
}) {
  return (
    <XStack
      minHeight={floatingPinnedPostBannerHeight}
      paddingHorizontal="$l"
      paddingVertical="$s"
      backgroundColor="$positiveBackground"
      borderBottomWidth={1}
      borderBottomColor="$positiveBorder"
      alignItems="center"
      gap="$m"
      testID="BucketFileViewerScriptsBanner"
    >
      <Icon type="Lock" customSize={[16, 16]} color="$primaryText" />
      <Text size="$label/s" color="$primaryText" flex={1}>
        For security reasons, interactivity on this page is disabled by default.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enable interactivity on this page"
        hitSlop={12}
        onPress={onEnable}
        testID="BucketFileViewerEnableScripts"
      >
        <Text size="$label/s" color="$positiveActionText">
          Enable
        </Text>
      </Pressable>
    </XStack>
  );
}
