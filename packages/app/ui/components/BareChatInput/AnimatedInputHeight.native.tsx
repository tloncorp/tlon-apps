import { PropsWithChildren, useCallback, useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export function AnimatedInputHeight({
  children,
  minimumHeight,
}: PropsWithChildren<{ minimumHeight: number }>) {
  const height = useSharedValue(minimumHeight);
  const targetHeight = useRef(minimumHeight);
  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.max(
        minimumHeight,
        event.nativeEvent.layout.height
      );
      if (nextHeight === targetHeight.current) {
        return;
      }
      targetHeight.current = nextHeight;
      height.value = withTiming(nextHeight, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      });
    },
    [height, minimumHeight]
  );

  return (
    <Animated.View style={[styles.frame, animatedStyle]}>
      {/* Measure independently so the animation cannot feed back into native
          text measurement. Anchor the first line to the animated top edge:
          bottom anchoring would jump existing lines on every new line. */}
      <View style={styles.content} onLayout={handleLayout}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
});
