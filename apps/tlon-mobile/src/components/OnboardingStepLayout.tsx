import { ScreenHeader, TlonText, View, YStack } from '@tloncorp/app/ui';
import { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The cropped permission prompt shown on Allow notifications, in points.
export const NOTIFICATION_PROMPT_SIZE = Platform.select({
  ios: { width: 300, height: 276 },
  default: { width: 324, height: 284 },
});

export const ONBOARDING_STEP_MAX_WIDTH = 600;

// Allow notifications has the tallest block: two lines of body text, the gap,
// and the prompt picture. Every step reserves that height and centers it, so
// the body text starts at the same height on each screen.
const BODY_TWO_LINES = 48;
const BLOCK_GAP = 24;
const STEP_BLOCK_MIN_HEIGHT =
  BODY_TWO_LINES + BLOCK_GAP + NOTIFICATION_PROMPT_SIZE.height;

// Shared frame for the notification and setup steps at the end of signup:
// header, body text, a second block (options, picture or steps), and a bottom
// slot sized for the hero button, which stays empty when there is no footer.
export function OnboardingStepLayout({
  title,
  footer,
  children,
}: PropsWithChildren<{ title: string; footer?: ReactNode }>) {
  const insets = useSafeAreaInsets();
  return (
    <View
      flex={1}
      paddingBottom={insets.bottom}
      backgroundColor="$secondaryBackground"
    >
      <ScreenHeader title={title} backgroundColor="$secondaryBackground" />
      <YStack
        flex={1}
        // Yoga drops cross-axis stretch when a horizontal margin is `auto`,
        // so without an explicit width this hugs its content.
        width="100%"
        maxWidth={ONBOARDING_STEP_MAX_WIDTH}
        marginHorizontal="auto"
        paddingHorizontal="$2xl"
      >
        <View flexGrow={1} flexBasis={0} minHeight="$2xl" />
        <YStack minHeight={STEP_BLOCK_MIN_HEIGHT} gap={BLOCK_GAP}>
          {children}
        </YStack>
        <View flexGrow={1} flexBasis={0} />
        {footer ?? <View height="$6xl" />}
      </YStack>
    </View>
  );
}

// Body text always takes at least two lines, so the block under it starts at
// the same height on every step, and stays put when the copy changes.
export function OnboardingStepBody(
  props: ComponentProps<typeof TlonText.Text>
) {
  return (
    <TlonText.Text
      size="$body"
      color="$primaryText"
      minHeight={BODY_TWO_LINES}
      {...props}
    />
  );
}
