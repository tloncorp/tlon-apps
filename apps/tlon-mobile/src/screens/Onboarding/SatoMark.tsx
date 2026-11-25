import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from 'tamagui';

// The 里 on a 32-unit square: one block of ink with rounded slits. The
// slits inside the top cell stop short of the edges; the lower ones run out
// past them, where a half-round notch takes the square's corner.
const SLITS = [
  { x: 5.5, y: 4.8, width: 7.75 },
  { x: 18.75, y: 4.8, width: 7.75 },
  { x: 5.5, y: 11.6, width: 7.75 },
  { x: 18.75, y: 11.6, width: 7.75 },
  { x: -4, y: 18.4, width: 17.25 },
  { x: 18.75, y: 18.4, width: 17.25 },
  { x: -4, y: 25.2, width: 17.25 },
  { x: 18.75, y: 25.2, width: 17.25 },
];
const NOTCHES = [
  'M0 16 A2.4 2.4 0 0 0 2.4 18.4 V20.4 A2.4 2.4 0 0 0 0 22.8 Z',
  'M32 16 A2.4 2.4 0 0 1 29.6 18.4 V20.4 A2.4 2.4 0 0 1 32 22.8 Z',
  'M0 22.8 A2.4 2.4 0 0 0 2.4 25.2 V27.2 A2.4 2.4 0 0 0 0 29.6 Z',
  'M32 22.8 A2.4 2.4 0 0 1 29.6 25.2 V27.2 A2.4 2.4 0 0 1 32 29.6 Z',
];

const BREATH_MS = 3000;

/**
 * The welcome screen's mark, drawn flat in the text color. It breathes
 * slowly unless the phone asks for reduced motion.
 */
export function SatoMark({ size = 112 }: { size?: number }) {
  const theme = useTheme();
  const ink = theme.primaryText?.val as string;
  const ground = theme.background?.val as string;
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
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Rect width={32} height={32} rx={2.4} fill={ink} />
        {SLITS.map(({ x, y, width }) => (
          <Rect
            key={`${x},${y}`}
            x={x}
            y={y}
            width={width}
            height={2}
            rx={1}
            fill={ground}
          />
        ))}
        {NOTCHES.map((d) => (
          <Path key={d} d={d} fill={ground} />
        ))}
      </Svg>
    </Animated.View>
  );
}
