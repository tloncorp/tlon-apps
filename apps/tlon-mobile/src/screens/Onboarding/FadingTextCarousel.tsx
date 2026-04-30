import { TlonText } from '@tloncorp/app/ui';
import { useEffect, useState } from 'react';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface FadingTextCarouselProps {
  messages: string[];
  holdMs?: number;
  fadeMs?: number;
  travelDistance?: number;
}

export function FadingTextCarousel({
  messages,
  holdMs = 2400,
  fadeMs = 600,
  travelDistance = 12,
}: FadingTextCarouselProps) {
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(travelDistance);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const nextIndex = (index + 1) % messages.length;

    opacity.value = 0;
    translateY.value = travelDistance;

    opacity.value = withSequence(
      withTiming(1, { duration: fadeMs, easing: Easing.out(Easing.cubic) }),
      withDelay(
        holdMs,
        withTiming(0, { duration: fadeMs, easing: Easing.in(Easing.cubic) })
      )
    );

    translateY.value = withSequence(
      withTiming(0, { duration: fadeMs, easing: Easing.out(Easing.cubic) }),
      withDelay(
        holdMs,
        withTiming(
          -travelDistance,
          { duration: fadeMs, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) {
              runOnJS(setIndex)(nextIndex);
            }
          }
        )
      )
    );
  }, [
    index,
    messages.length,
    holdMs,
    fadeMs,
    travelDistance,
    opacity,
    translateY,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (messages.length === 0) {
    return null;
  }

  return (
    <Animated.View style={animatedStyle}>
      <TlonText.Text textAlign="center" color="$secondaryText">
        {messages[index]}
      </TlonText.Text>
    </Animated.View>
  );
}
