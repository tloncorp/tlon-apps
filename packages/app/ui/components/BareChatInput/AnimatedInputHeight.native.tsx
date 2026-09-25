import { PropsWithChildren, useCallback, useLayoutEffect, useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export function AnimatedInputHeight({
  children,
  minimumHeight,
  holdHeight = false,
  onHeightSettled,
}: PropsWithChildren<{
  minimumHeight: number;
  holdHeight?: boolean;
  onHeightSettled?: () => void;
}>) {
  const height = useSharedValue(minimumHeight);
  const targetHeight = useRef(minimumHeight);
  const measuredHeight = useRef(minimumHeight);
  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));
  const animateToHeight = useCallback(
    (nextHeight: number) => {
      if (nextHeight === targetHeight.current) {
        if (height.value === nextHeight) {
          onHeightSettled?.();
        }
        return;
      }
      targetHeight.current = nextHeight;
      height.value = withTiming(
        nextHeight,
        {
          duration: 180,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        },
        (finished) => {
          if (finished && onHeightSettled) {
            runOnJS(onHeightSettled)();
          }
        }
      );
    },
    [height, onHeightSettled]
  );
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      measuredHeight.current = Math.max(
        minimumHeight,
        event.nativeEvent.layout.height
      );
      if (!holdHeight || measuredHeight.current > targetHeight.current) {
        animateToHeight(measuredHeight.current);
      }
    },
    [animateToHeight, holdHeight, minimumHeight]
  );
  useLayoutEffect(() => {
    if (!holdHeight) {
      animateToHeight(measuredHeight.current);
    }
  }, [animateToHeight, holdHeight]);

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
