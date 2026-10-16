import { Pressable, Text } from '@tloncorp/ui';
import { transparentize } from 'color2k';
import { PropsWithChildren, useCallback, useState } from 'react';
import { LayoutChangeEvent, Platform, View } from 'react-native';
import { YStack } from 'tamagui';
import { LinearGradient } from 'tamagui/linear-gradient';

const FADE_HEIGHT = 72;

/**
 * Content cut to `collapsedHeight` under a fade, with a toggle to show the
 * rest. `fadeColor` is the surface it sits on, as a resolved color rather
 * than a theme token. Content that would lose less than the fade's own height
 * is shown whole, with no toggle.
 */
export function ExpandableContent({
  collapsedHeight,
  fadeColor,
  testID,
  children,
}: PropsWithChildren<{
  collapsedHeight: number;
  fadeColor: string;
  testID?: string;
}>) {
  const [expanded, setExpanded] = useState(false);
  // Measured on the unclipped content, so it holds while collapsed. Until it
  // is measured the content is clipped, which keeps long content from
  // flashing at full height.
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const overflows =
    contentHeight !== null && contentHeight > collapsedHeight + FADE_HEIGHT;
  const clipped = !expanded && (contentHeight === null || overflows);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setContentHeight(event.nativeEvent.layout.height);
  }, []);
  const toggle = useCallback(() => setExpanded((value) => !value), []);

  return (
    <YStack>
      <YStack
        maxHeight={clipped ? collapsedHeight : undefined}
        // Yoga lays children out within the height of a box that hides its
        // overflow, which collapses `flex: 1` content such as rendered lists
        // to nothing and spoils the measurement. A box set to scroll clips the
        // same way without bounding its children. Web layout is unaffected.
        overflow={Platform.OS === 'web' ? 'hidden' : 'scroll'}
      >
        {/* A plain view: on web, a Tamagui stack in this spot never reports
            its layout. */}
        <View onLayout={handleLayout}>{children}</View>
        {overflows && !expanded ? (
          <LinearGradient
            pointerEvents="none"
            position="absolute"
            left={0}
            right={0}
            bottom={0}
            height={FADE_HEIGHT}
            colors={[transparentize(fadeColor, 1), fadeColor]}
          />
        ) : null}
      </YStack>
      {overflows ? (
        <Pressable
          onPress={toggle}
          role="button"
          aria-expanded={expanded}
          {...(Platform.OS === 'web'
            ? {
                tabIndex: 0,
                onKeyDown: (event: { key: string; preventDefault(): void }) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggle();
                  }
                },
              }
            : null)}
          minHeight={44}
          justifyContent="center"
          paddingHorizontal="$l"
          testID={testID ? `${testID}Toggle` : undefined}
        >
          <Text size="$label/m" color="$positiveActionText">
            {expanded ? 'Show less' : 'Show more'}
          </Text>
        </Pressable>
      ) : null}
    </YStack>
  );
}
