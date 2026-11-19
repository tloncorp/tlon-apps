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
  snapShrink = false,
  onHeightSettled,
}: PropsWithChildren<{
  minimumHeight: number;
  holdHeight?: boolean;
  /** Shrink at once instead of animating. */
  snapShrink?: boolean;
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
      if (holdHeight && measuredHeight.current <= targetHeight.current) {
        return;
      }
      if (snapShrink && measuredHeight.current < targetHeight.current) {
        targetHeight.current = measuredHeight.current;
        height.value = measuredHeight.current;
        onHeightSettled?.();
        return;
      }
      animateToHeight(measuredHeight.current);
    },
    [
      animateToHeight,
      height,
      holdHeight,
      minimumHeight,
      onHeightSettled,
      snapShrink,
    ]
  );
  useLayoutEffect(() => {
    if (!holdHeight) {
      animateToHeight(measuredHeight.current);
    }
  }, [animateToHeight, holdHeight]);
  // A composer already at its minimum has nothing to shrink, so no layout
  // will report the shrink: it is settled as soon as it is asked to snap.
  useLayoutEffect(() => {
    if (snapShrink && targetHeight.current <= minimumHeight) {
      onHeightSettled?.();
    }
  }, [minimumHeight, onHeightSettled, snapShrink]);

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
