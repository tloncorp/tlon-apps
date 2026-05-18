import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

interface SegmentedSpinnerProps {
  size?: number;
  color?: string;
  segmentCount?: number;
  strokeWidth?: number;
  durationMs?: number;
}

export function SegmentedSpinner({
  size = 160,
  color = '#008EFF',
  segmentCount = 12,
  strokeWidth,
  durationMs = 2400,
}: SegmentedSpinnerProps) {
  const sw = strokeWidth ?? Math.max(4, Math.round(size / 32));
  const center = size / 2;
  const radius = (size - sw) / 2;
  const circumference = 2 * Math.PI * radius;
  const segmentLength = circumference / segmentCount;
  const dashLength = segmentLength * 0.55;
  const gapLength = segmentLength - dashLength;

  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, {
        duration: durationMs,
        easing: Easing.inOut(Easing.cubic),
      }),
      -1,
      false
    );
  }, [durationMs, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={sw}
          strokeDasharray={`${dashLength} ${gapLength}`}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}
