import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from 'tamagui';

const HOLD_DURATION_MS = 3000;
const FADE_DURATION_MS = 2000;

export function ChatMessageHighlight({ active }: { active: boolean }) {
  const theme = useTheme();
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      opacity.value = withSequence(
        withTiming(1, { duration: 0 }),
        withDelay(
          HOLD_DURATION_MS,
          withTiming(0, { duration: FADE_DURATION_MS })
        )
      );
    } else {
      opacity.value = 0;
    }
  }, [active, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.positiveBackground?.val,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    />
  );
}
