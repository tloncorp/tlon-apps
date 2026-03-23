import { useEffect, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { isWeb } from 'tamagui';
import { useTheme } from 'tamagui';

const HOLD_DURATION_MS = 3000;
const FADE_DURATION_MS = 2000;

const baseStyle = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

function ChatMessageHighlightWeb({ active }: { active: boolean }) {
  const theme = useTheme();
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (active) {
      setFading(false);
      const timer = setTimeout(() => setFading(true), HOLD_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (!active) {
    return null;
  }

  return (
    <div
      style={{
        ...baseStyle,
        backgroundColor: theme.positiveBackground?.val,
        opacity: fading ? 0 : 1,
        transition: fading
          ? `opacity ${FADE_DURATION_MS}ms ease-out`
          : undefined,
        pointerEvents: 'none',
      }}
    />
  );
}

function ChatMessageHighlightNative({ active }: { active: boolean }) {
  const theme = useTheme();
  const opacity = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    if (active) {
      opacity.value = 1;
      opacity.value = withDelay(
        HOLD_DURATION_MS,
        withTiming(0, { duration: FADE_DURATION_MS })
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
          ...baseStyle,
          backgroundColor: theme.positiveBackground?.val,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    />
  );
}

export function ChatMessageHighlight({ active }: { active: boolean }) {
  return isWeb ? (
    <ChatMessageHighlightWeb active={active} />
  ) : (
    <ChatMessageHighlightNative active={active} />
  );
}
