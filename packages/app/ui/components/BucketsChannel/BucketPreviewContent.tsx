import { ReactNode, useEffect } from 'react';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { View } from 'tamagui';

export function BucketPreviewContent({
  children,
  loading,
  animate = true,
}: {
  children: ReactNode;
  loading: boolean;
  animate?: boolean;
}) {
  return (
    <View flex={1} minHeight={0} backgroundColor="$secondaryBackground">
      {!loading && animate ? (
        <BucketPreviewFade>{children}</BucketPreviewFade>
      ) : (
        children
      )}
    </View>
  );
}

export function BucketPreviewFade({
  children,
  ready = true,
}: {
  children: ReactNode;
  ready?: boolean;
}) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.set(
      ready
        ? withTiming(1, { duration: 220, reduceMotion: ReduceMotion.System })
        : 0
    );
  }, [opacity, ready]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={[{ flex: 1, minHeight: 0 }, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
