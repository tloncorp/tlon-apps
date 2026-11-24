import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

const ICON = 200;
const TILE = 188;
const TILE_RADIUS = 44;
const MARK = 100;
const MARK_INK = '#383838';

/**
 * A soft dark spot behind the mark. It sits at (hx, hy) from the tile's
 * middle and swings across it on x and y separately, eased back and forth,
 * far enough to pass off the nearest edge; it also breathes between 85% and
 * 115%. Periods are in seconds.
 */
type Spot = {
  hx: number;
  hy: number;
  size: number;
  ax: number;
  ay: number;
  tx: number;
  ty: number;
  ts: number;
};

const SPOTS: Spot[] = [
  { hx: -75, hy: -60, size: 160, ax: 155, ay: 55, tx: 48, ty: 29, ts: 21 },
  { hx: 65, hy: -75, size: 150, ax: 55, ay: 150, tx: 33, ty: 52, ts: 23 },
  { hx: 75, hy: 65, size: 170, ax: 160, ay: 50, tx: 58, ty: 31, ts: 25 },
  { hx: -60, hy: 75, size: 155, ax: 60, ay: 150, tx: 37, ty: 50, ts: 19 },
];

/** How far, in seconds, each of a spot's three swings starts into itself. */
type SpotStart = { x: number; y: number; scale: number };

/** A random place in each swing, so the spots start somewhere new each time. */
function randomStarts(): SpotStart[] {
  return SPOTS.map((spot) => ({
    x: Math.random() * 2 * spot.tx,
    y: Math.random() * 2 * spot.ty,
    scale: Math.random() * 2 * spot.ts,
  }));
}

/**
 * A spot's fade from its middle, as the canvas draws it: a radial gradient
 * blurred by 18 pt. Its reach, as a share of the spot's size, is where the
 * blur runs out.
 */
const SPOT_REACH = 0.8375;
const SPOT_FADE: [number, number][] = [
  [0, 0.269],
  [0.1, 0.254],
  [0.2, 0.215],
  [0.3, 0.161],
  [0.4, 0.104],
  [0.5, 0.056],
  [0.6, 0.023],
  [0.7, 0.007],
  [0.8, 0.0015],
  [1, 0],
];

const easeInOut = Easing.bezierFn(0.42, 0, 0.58, 1);

/** Where a back-and-forth swing of `period` seconds is at `t`, from -1 to 1. */
function swing(t: number, period: number) {
  'worklet';
  const cycle = t / period;
  const iteration = Math.floor(cycle);
  const progress = cycle - iteration;
  const eased = easeInOut(iteration % 2 === 0 ? progress : 1 - progress);
  return eased * 2 - 1;
}

/**
 * The Sato icon on the welcome screen: the tilted tile and flat 里 mark of
 * the old icon image, with its shading drawn as four soft spots that drift
 * slowly behind the mark, clipped by the tile. Each time the screen opens
 * they start from a random place. With Reduce Motion on, they stand still
 * there.
 */
export function WelcomeIcon() {
  const reduceMotion = useReducedMotion();
  const [starts] = useState(randomStarts);
  const seconds = useSharedValue(0);
  useFrameCallback((frame) => {
    seconds.set(frame.timeSinceFirstFrame / 1000);
  }, !reduceMotion);
  const ids = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View
      style={styles.icon}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Sato"
    >
      <View style={styles.tileShadow}>
        <View style={styles.tile}>
          <Svg width={TILE} height={TILE} style={StyleSheet.absoluteFill}>
            <Defs>
              {/* CSS's linear-gradient(160deg) across a square tile. */}
              <LinearGradient
                id={`${ids}-ground`}
                gradientUnits="userSpaceOnUse"
                x1={52.8}
                y1={-19.3}
                x2={135.2}
                y2={207.3}
              >
                <Stop offset={0} stopColor="#FBFBFB" />
                <Stop offset={1} stopColor="#EEEEEE" />
              </LinearGradient>
            </Defs>
            <Rect
              width={TILE}
              height={TILE}
              rx={TILE_RADIUS}
              fill={`url(#${ids}-ground)`}
            />
            <Rect
              x={0.5}
              y={0.5}
              width={TILE - 1}
              height={TILE - 1}
              rx={TILE_RADIUS - 0.5}
              fill="none"
              stroke="#DCDCDC"
              strokeWidth={1}
            />
          </Svg>
          {SPOTS.map((spot, index) => (
            <SpotView
              key={index}
              spot={spot}
              start={starts[index]}
              seconds={seconds}
              gradientId={`${ids}-spot${index}`}
            />
          ))}
          <Svg
            width={MARK}
            height={MARK}
            viewBox="3.05 3.05 17.9 17.9"
            style={styles.mark}
          >
            <Path
              d="M20.5 19.727L3.5 19.727L3.5 18.282L11.167 18.282L11.167 16.106L4.778 16.106L4.778 14.718L11.167 14.718L11.167 12.866L5.574 12.866L5.574 4.273L18.083 4.273L18.083 12.866L12.583 12.866L12.583 14.718L19.167 14.718L19.167 16.106L12.583 16.106L12.583 18.282L20.5 18.282ZM16.648 7.801L16.648 5.653L12.583 5.653L12.583 7.801ZM11.167 5.653L7.074 5.653L7.074 7.801L11.148 7.801ZM16.648 11.477L16.648 9.181L12.583 9.181L12.583 11.477ZM11.167 11.477L11.167 9.181L7.074 9.181L7.074 11.477Z"
              fill={MARK_INK}
              fillRule="evenodd"
            />
          </Svg>
        </View>
      </View>
    </View>
  );
}

function SpotView({
  spot,
  start,
  seconds,
  gradientId,
}: {
  spot: Spot;
  start: SpotStart;
  /** Time since the screen opened; it stays 0 with Reduce Motion on. */
  seconds: SharedValue<number>;
  gradientId: string;
}) {
  const reach = spot.size * SPOT_REACH;
  const motion = useAnimatedStyle(() => {
    const t = seconds.value;
    return {
      transform: [
        { translateX: spot.ax * swing(t + start.x, spot.tx) },
        { translateY: spot.ay * swing(t + start.y, spot.ty) },
        { scale: 1 + 0.15 * swing(t + start.scale, spot.ts) },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: TILE / 2 + spot.hx - reach,
          top: TILE / 2 + spot.hy - reach,
          width: reach * 2,
          height: reach * 2,
        },
        motion,
      ]}
    >
      <Svg width={reach * 2} height={reach * 2}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            {SPOT_FADE.map(([offset, opacity]) => (
              <Stop
                key={offset}
                offset={offset}
                stopColor="#181818"
                stopOpacity={opacity}
              />
            ))}
          </RadialGradient>
        </Defs>
        <Circle cx={reach} cy={reach} r={reach} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: ICON,
    height: ICON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileShadow: {
    width: TILE,
    height: TILE,
    borderRadius: TILE_RADIUS,
    backgroundColor: '#EEEEEE',
    transform: [{ rotate: '-5deg' }],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 1.5,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: TILE_RADIUS,
    overflow: 'hidden',
  },
  mark: {
    position: 'absolute',
    left: (TILE - MARK) / 2,
    top: (TILE - MARK) / 2,
  },
});
