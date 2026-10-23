import { Pressable, Text } from '@tloncorp/ui';
import { useEffect } from 'react';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export function BucketPreviewOpenButton({ onPress }: { onPress?: () => void }) {
  const enabled = !!onPress;
  const opacity = useSharedValue(enabled ? 1 : 0.4);
  useEffect(() => {
    opacity.set(
      withTiming(enabled ? 1 : 0.4, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [enabled, opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        role="button"
        accessibilityLabel="Open"
        aria-label="Open"
        accessibilityState={{ disabled: !enabled }}
        aria-disabled={!enabled}
        disabled={!enabled}
        onPress={onPress}
        alignItems="center"
        cursor={enabled ? 'pointer' : 'default'}
        height="$4xl"
        justifyContent="center"
        paddingHorizontal="$s"
        paddingTop="$xs"
        testID="BucketPreviewOpen"
      >
        <Text size="$label/2xl" color="$primaryText">
          Open
        </Text>
      </Pressable>
    </Animated.View>
  );
}
