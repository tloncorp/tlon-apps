import { Pressable, Text } from '@tloncorp/ui';
import { transparentize } from 'color2k';
import { PropsWithChildren, useCallback, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import { YStack } from 'tamagui';
import { LinearGradient } from 'tamagui/linear-gradient';

const FADE_HEIGHT = 72;

/**
 * Content cut to `collapsedHeight` under a fade into `fadeColor`, the surface
 * it sits on, with a toggle to show the rest. Content that fits is shown
 * whole, with no toggle.
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
  // Measured on the unclipped content, so it holds while collapsed. Clipping
  // from the first frame keeps long content from flashing at full height.
  const [contentHeight, setContentHeight] = useState(0);
  const overflows = contentHeight > collapsedHeight;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setContentHeight(event.nativeEvent.layout.height);
  }, []);

  return (
    <YStack>
      <YStack
        maxHeight={expanded ? undefined : collapsedHeight}
        overflow="hidden"
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
          onPress={() => setExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
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
