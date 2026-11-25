import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '@tloncorp/app/ui';

// The Sato icon draws the mark 17 units wide in its 24-unit box.
const ICON_BOX_PER_MARK = 24 / 17;

const BREATH_MS = 3000;

/**
 * The welcome screen's mark: the Sato icon in the text color. It breathes
 * slowly unless the phone asks for reduced motion.
 */
export function SatoMark({ size = 112 }: { size?: number }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withTiming(1.035, {
        duration: BREATH_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [reduceMotion, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={style}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Sato"
      testID="welcome-mark"
    >
      <Icon
        type="Sato"
        color="$primaryText"
        customSize={[size, size * ICON_BOX_PER_MARK]}
      />
    </Animated.View>
  );
}
