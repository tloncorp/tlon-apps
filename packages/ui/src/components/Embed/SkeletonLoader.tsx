import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { YStack, useTheme } from 'tamagui';

interface SkeletonLoaderProps {
  width?: number;
  height?: number;
}

export function SkeletonLoader({
  width = 300,
  height = 300,
}: SkeletonLoaderProps) {
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withRepeat(
          withSequence(
            withTiming(-width * 2, {
              duration: 0,
              easing: Easing.linear,
            }),
            withTiming(width * 2, {
              duration: 1500,
              easing: Easing.linear,
            })
          ),
          -1,
          false
        ),
      },
    ],
  }));

  const primaryBackground = useTheme().background.val;

  return (
    <YStack
      backgroundColor="$secondaryBackground"
      width={width}
      height={height}
      borderRadius="$s"
      overflow="hidden"
      padding="$m"
    >
      <YStack gap="$s">
        <YStack
          width="60%"
          height="$2xl"
          backgroundColor="$tertiaryBackground"
          borderRadius="$s"
        />
        <YStack
          width="100%"
          height="$xl"
          backgroundColor="$tertiaryBackground"
          borderRadius="$s"
        />
        <YStack
          width="40%"
          height="$xl"
          backgroundColor="$tertiaryBackground"
          borderRadius="$s"
        />
      </YStack>

      <Animated.View
        style={[StyleSheet.absoluteFill, shimmerStyle, { width: width * 2 }]}
      >
        <LinearGradient
          colors={['transparent', primaryBackground, 'transparent']}
          start={{ x: 0.4, y: 0 }}
          end={{ x: 0.6, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </YStack>
  );
}
