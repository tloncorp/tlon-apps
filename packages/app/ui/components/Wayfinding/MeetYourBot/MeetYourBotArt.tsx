import { BlurView } from 'expo-blur';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { useIsDarkMode } from '../../../../hooks/useDarkMode';

// The art is drawn on a fixed 393 x 352 stage and centred in whatever width
// it is given; the emoji field runs well past both edges so wide phones are
// still covered.
export const ART_WIDTH = 393;
export const ART_HEIGHT = 352;

const EASE = Easing.bezier(0.37, 0, 0.63, 1);
const EMOJI = ['🤖', '🛎️', '🔍', '🌱', '🌤️', '📥'];
const PAGE = { light: '#FFFFFF', dark: '#1A1818' };
// On dark, the plain dark blur lays a grey haze over the glass; the thinnest
// material keeps it clear.
const DARK_GLASS = 'systemUltraThinMaterialDark' as const;

type Mode = 'light' | 'dark';
type Slide = 1 | 2;

const CHIP_TINT: Record<Slide, Record<Mode, [string, string]>> = {
  1: {
    light: ['rgba(220,255,210,0.55)', 'rgba(170,230,160,0.35)'],
    dark: ['rgba(190,240,180,0.62)', 'rgba(110,195,100,0.42)'],
  },
  2: {
    light: ['rgba(195,218,255,0.92)', 'rgba(130,176,245,0.82)'],
    dark: ['rgba(200,220,255,0.62)', 'rgba(110,160,240,0.42)'],
  },
};

// Each motion runs on its own period, so together they never visibly loop.
function useLoop(halfPeriodMs: number, reduceMotion: boolean) {
  const value = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    value.set(
      withRepeat(
        withTiming(1, { duration: halfPeriodMs, easing: EASE }),
        -1,
        true
      )
    );
    return () => cancelAnimation(value);
  }, [halfPeriodMs, reduceMotion, value]);
  return value;
}

// Two quick blinks at uneven gaps in every 7 seconds.
function useBlink(reduceMotion: boolean) {
  const value = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    const close = () => withTiming(0.12, { duration: 126 });
    const open = () => withTiming(1, { duration: 119 });
    value.set(
      withRepeat(
        withSequence(
          withDelay(4060, close()),
          open(),
          withDelay(1995, close()),
          open(),
          withDelay(455, withTiming(1, { duration: 0 }))
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(value);
  }, [reduceMotion, value]);
  return value;
}

// A slow glance to one side and back, once every 19 seconds.
function useGlance(reduceMotion: boolean) {
  const value = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const easing = Easing.inOut(Easing.ease);
    value.set(
      withRepeat(
        withSequence(
          withDelay(7600, withTiming(1, { duration: 1900, easing })),
          withDelay(2660, withTiming(0, { duration: 1900, easing })),
          withDelay(4940, withTiming(0, { duration: 0 }))
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(value);
  }, [reduceMotion, value]);
  return value;
}

// The Tlonbot mark's proportions, as fractions of the tile's side.
const MARK = {
  tilt: '-4.2deg',
  radius: 0.155,
  eyeX: 0.099,
  eyeY: -0.088,
  eyeWidth: 0.044,
  eyeHeight: 0.113,
  smileHalfWidth: 0.0945,
  smileY: 0.104,
  smileSag: 0.034,
  stroke: 0.044,
  glance: -0.0104,
};

function Face({ size, reduceMotion }: { size: number; reduceMotion: boolean }) {
  const blink = useBlink(reduceMotion);
  const glance = useGlance(reduceMotion);
  const glanceStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: glance.value * MARK.glance * size }],
  }));
  const blinkStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: blink.value }],
  }));
  const eye = (side: -1 | 1) => ({
    position: 'absolute' as const,
    left: size * (0.5 + side * MARK.eyeX - MARK.eyeWidth / 2),
    top: size * (0.5 + MARK.eyeY - MARK.eyeHeight / 2),
    width: size * MARK.eyeWidth,
    height: size * MARK.eyeHeight,
    borderRadius: (size * MARK.eyeWidth) / 2,
    backgroundColor: '#16181D',
  });
  // A cubic whose control points sit level reaches 3/4 of their depth.
  const half = MARK.smileHalfWidth * 100;
  const y = (0.5 + MARK.smileY) * 100;
  const depth = ((MARK.smileSag * 100) / 3) * 4;
  const smile = `M${50 - half} ${y}C${50 - half * 0.476} ${y + depth} ${50 + half * 0.476} ${y + depth} ${50 + half} ${y}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, glanceStyle]}>
        <Animated.View style={[eye(-1), blinkStyle]} />
        <Animated.View style={[eye(1), blinkStyle]} />
      </Animated.View>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path
          d={smile}
          stroke="#16181D"
          strokeWidth={MARK.stroke * 100}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

function Sheen({ reduceMotion }: { reduceMotion: boolean }) {
  const sweep = useLoop(3800, reduceMotion);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -18 + 36 * sweep.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: '-30%',
          top: '-10%',
          width: '160%',
          height: '120%',
        },
        style,
      ]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="myb-sheen" x1="0" y1="0.3" x2="1" y2="0.7">
            <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.32} />
            <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#myb-sheen)" />
      </Svg>
    </Animated.View>
  );
}

/** The bot: a frosted, tinted glass tile with a face. */
function Chip({
  slide,
  mode,
  size,
  reduceMotion,
}: {
  slide: Slide;
  mode: Mode;
  size: number;
  reduceMotion: boolean;
}) {
  const [from, to] = CHIP_TINT[slide][mode];
  const gradientId = `myb-chip-${slide}-${mode}`;
  return (
    <View
      style={{
        width: size,
        height: size,
        transform: [{ rotate: MARK.tilt }],
        shadowColor: mode === 'light' ? '#1E285A' : '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 11,
        shadowOpacity: mode === 'light' ? 0.1 : 0.3,
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: size * MARK.radius,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor:
            mode === 'light'
              ? 'rgba(255,255,255,0.65)'
              : 'rgba(255,255,255,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BlurView
          intensity={40}
          tint={mode === 'light' ? 'light' : DARK_GLASS}
          style={StyleSheet.absoluteFill}
        />
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradientId} x1="0.2" y1="0" x2="0.8" y2="1">
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
        <Sheen reduceMotion={reduceMotion} />
        <Face size={size - 2} reduceMotion={reduceMotion} />
      </View>
    </View>
  );
}

/** A soft round shadow on the ground that shrinks as the bot rises. */
function GroundShadow({
  mode,
  rise,
  style,
  shrink,
}: {
  mode: Mode;
  rise: SharedValue<number>;
  style: { left: number; top: number; width: number; height: number };
  shrink: number;
}) {
  const animated = useAnimatedStyle(() => ({
    opacity: 1 - (1 - shrink) * 2.3 * rise.value,
    transform: [{ scale: 1 - (1 - shrink) * rise.value }],
  }));
  const id = `myb-ground-${mode}`;
  return (
    <Animated.View style={[{ position: 'absolute', ...style }, animated]}>
      <Svg width={style.width} height={style.height}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop
              offset="0"
              stopColor={mode === 'light' ? '#1E285A' : '#000000'}
              stopOpacity={mode === 'light' ? 0.24 : 0.6}
            />
            <Stop
              offset="1"
              stopColor={mode === 'light' ? '#1E285A' : '#000000'}
              stopOpacity={0}
            />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={style.width / 2}
          cy={style.height / 2}
          rx={style.width / 2}
          ry={style.height / 2}
          fill={`url(#${id})`}
        />
      </Svg>
    </Animated.View>
  );
}

function FloatingBot({
  mode,
  reduceMotion,
}: {
  mode: Mode;
  reduceMotion: boolean;
}) {
  const rise = useLoop(3000, reduceMotion);
  const drift = useLoop(4700, reduceMotion);
  const sway = useLoop(3800, reduceMotion);
  const riseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -14 * rise.value }],
  }));
  const driftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -3 + 6 * drift.value }],
  }));
  const swayStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-2.5 + 5.5 * sway.value}deg` }],
  }));
  return (
    <View
      style={{
        position: 'absolute',
        left: 196.5 - 83,
        top: 190 - 83,
        width: 166,
        height: 166,
      }}
    >
      <GroundShadow
        mode={mode}
        rise={rise}
        shrink={0.78}
        style={{ left: 20, top: 184, width: 126, height: 20 }}
      />
      <Animated.View style={[StyleSheet.absoluteFill, riseStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, driftStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, swayStyle]}>
            <Chip
              slide={1}
              mode={mode}
              size={166}
              reduceMotion={reduceMotion}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const DOME_STOPS: Record<Mode, [string, string, number][]> = {
  light: [
    ['0', '#FFFFFF', 0.1],
    ['0.62', '#FFFFFF', 0.03],
    ['0.86', '#5078BE', 0.07],
    ['1', '#466EB4', 0.15],
  ],
  dark: [
    ['0', '#FFFFFF', 0.02],
    ['0.7', '#FFFFFF', 0.04],
    ['1', '#FFFFFF', 0.16],
  ],
};

function DomedBot({
  mode,
  reduceMotion,
}: {
  mode: Mode;
  reduceMotion: boolean;
}) {
  const rise = useLoop(3400, reduceMotion);
  const sway = useLoop(4300, reduceMotion);
  const riseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -7 * rise.value }],
  }));
  const swayStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-1.5 + 3.5 * sway.value}deg` }],
  }));
  const light = mode === 'light';
  return (
    <View
      style={{
        position: 'absolute',
        left: 196.5 - 115,
        top: 178 - 130,
        width: 230,
        height: 260,
      }}
    >
      <GroundShadow
        mode={mode}
        rise={rise}
        shrink={0.82}
        style={{ left: 74, top: 226, width: 82, height: 12 }}
      />
      <Animated.View
        style={[{ position: 'absolute', left: 62, top: 116 }, riseStyle]}
      >
        <Animated.View style={swayStyle}>
          <Chip slide={2} mode={mode} size={106} reduceMotion={reduceMotion} />
        </Animated.View>
      </Animated.View>

      {/* The dome. On white, glass reads through its darks: a thin rim, a
          white line just inside it, and edges that darken as it curves away.
          On dark, it reads through its lights. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 230,
          height: 244,
          borderTopLeftRadius: 115,
          borderTopRightRadius: 115,
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: light
            ? 'rgba(60,95,160,0.34)'
            : 'rgba(255,255,255,0.55)',
        }}
      >
        <BlurView
          intensity={light ? 4 : 5}
          tint={light ? 'light' : DARK_GLASS}
          style={StyleSheet.absoluteFill}
        />
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={`myb-dome-${mode}`} cx="0.5" cy="0.44" r="0.62">
              {(light ? DOME_STOPS.light : DOME_STOPS.dark).map(
                ([offset, color, opacity]) => (
                  <Stop
                    key={offset}
                    offset={offset}
                    stopColor={color}
                    stopOpacity={opacity}
                  />
                )
              )}
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#myb-dome-${mode})`} />
        </Svg>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            borderTopLeftRadius: 114,
            borderTopRightRadius: 114,
            borderBottomLeftRadius: 13,
            borderBottomRightRadius: 13,
            borderWidth: 1.5,
            borderColor: light
              ? 'rgba(255,255,255,0.9)'
              : 'rgba(255,255,255,0.12)',
          }}
        />
      </View>

      <Svg
        width={12}
        height={light ? 118 : 120}
        style={{ position: 'absolute', left: 30, top: light ? 46 : 44 }}
      >
        <Defs>
          <LinearGradient id={`myb-streak-${mode}`} x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0"
              stopColor="#FFFFFF"
              stopOpacity={light ? 0.95 : 0.6}
            />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect
          width={12}
          height={light ? 118 : 120}
          rx={6}
          fill={`url(#myb-streak-${mode})`}
        />
      </Svg>
      <Svg
        width={230}
        height={244}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <Path
          d="M44 40A103 103 0 0 1 96 13"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={4}
          strokeLinecap="round"
          opacity={light ? 0.95 : 0.7}
        />
        <Path
          d="M205 72A103 103 0 0 1 213 100"
          fill="none"
          stroke={light ? '#3C5FA0' : '#FFFFFF'}
          strokeOpacity={light ? 0.09 : 0.16}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </Svg>

      {/* The base */}
      <View
        style={{
          position: 'absolute',
          left: -16,
          top: 238,
          width: 262,
          height: 22,
          borderRadius: 11,
          shadowColor: light ? '#28468C' : '#000000',
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 6,
          shadowOpacity: light ? 0.1 : 0.3,
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 11,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: light
              ? 'rgba(60,95,160,0.26)'
              : 'rgba(255,255,255,0.32)',
          }}
        >
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient
                id={`myb-base-${mode}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                {light
                  ? [
                      <Stop key="0" offset="0" stopColor="#FFFFFF" />,
                      <Stop key="1" offset="1" stopColor="#DDE6F5" />,
                    ]
                  : [
                      <Stop
                        key="0"
                        offset="0"
                        stopColor="#FFFFFF"
                        stopOpacity={0.22}
                      />,
                      <Stop
                        key="1"
                        offset="1"
                        stopColor="#FFFFFF"
                        stopOpacity={0.05}
                      />,
                    ]}
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#myb-base-${mode})`} />
          </Svg>
        </View>
      </View>
    </View>
  );
}

/** The field of small emoji behind the bot, tilted, as on the earlier art. */
function EmojiField({ mode }: { mode: Mode }) {
  const items = useMemo(() => {
    const out: { key: string; e: string; x: number; y: number }[] = [];
    let row = 0;
    for (let y = -60; y < 430; y += 30, row++) {
      let col = 0;
      for (let x = -80 + (row % 2) * 18; x < 480; x += 36, col++) {
        out.push({
          key: `${x}:${y}`,
          e: EMOJI[(row * 4 + col) % EMOJI.length],
          x,
          y,
        });
      }
    }
    return out;
  }, []);
  return (
    <View
      style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-14deg' }] }]}
      pointerEvents="none"
    >
      {items.map((item) => (
        <Text
          key={item.key}
          allowFontScaling={false}
          style={{
            position: 'absolute',
            left: item.x,
            top: item.y,
            fontSize: 12.5,
            lineHeight: 15,
            opacity: mode === 'light' ? 0.34 : 0.17,
          }}
        >
          {item.e}
        </Text>
      ))}
    </View>
  );
}

/** A wash that clears the emoji around the bot, then a soft tint behind it. */
function Halo({ slide, mode }: { slide: Slide; mode: Mode }) {
  const wash = mode === 'light' ? '#FFFFFF' : PAGE.dark;
  const glow =
    slide === 1
      ? mode === 'light'
        ? '#96D78C'
        : '#43A84E'
      : mode === 'light'
        ? '#96C4F5'
        : '#3F7FE6';
  const cx = 196.5;
  if (slide === 1) {
    const cy = 190;
    return (
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id={`myb-wash-1-${mode}`}
            cx={cx}
            cy={cy}
            r={220}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={wash} stopOpacity={0} />
            <Stop offset="0.318" stopColor={wash} stopOpacity={0.1} />
            <Stop offset="0.5" stopColor={wash} stopOpacity={0.8} />
            <Stop offset="0.705" stopColor={wash} stopOpacity={0.55} />
            <Stop offset="1" stopColor={wash} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient
            id={`myb-glow-1-${mode}`}
            cx={cx}
            cy={cy}
            r={190}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={glow} stopOpacity={0.17} />
            <Stop offset="0.463" stopColor={glow} stopOpacity={0.55} />
            <Stop offset="0.663" stopColor={glow} stopOpacity={0.22} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#myb-wash-1-${mode})`} />
        <Rect width="100%" height="100%" fill={`url(#myb-glow-1-${mode})`} />
      </Svg>
    );
  }
  const cy = 200;
  // The emoji are cleared right under the dome so the glass reads clean;
  // outside it the field stays.
  const squash = 190 / 150;
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient
          id={`myb-wash-2-${mode}`}
          cx={cx}
          cy={cy - 15}
          r={150}
          gradientUnits="userSpaceOnUse"
          gradientTransform={`matrix(1 0 0 ${squash} 0 ${(cy - 15) * (1 - squash)})`}
        >
          <Stop offset="0" stopColor={wash} stopOpacity={0.97} />
          <Stop offset="0.76" stopColor={wash} stopOpacity={0.97} />
          <Stop offset="0.88" stopColor={wash} stopOpacity={0.45} />
          <Stop offset="1" stopColor={wash} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient
          id={`myb-glow-2-${mode}`}
          cx={cx}
          cy={cy}
          r={170}
          gradientUnits="userSpaceOnUse"
        >
          <Stop
            offset="0"
            stopColor={glow}
            stopOpacity={mode === 'light' ? 0.2 : 0.13}
          />
          <Stop
            offset="0.41"
            stopColor={glow}
            stopOpacity={mode === 'light' ? 0.5 : 0.42}
          />
          <Stop
            offset="0.62"
            stopColor={glow}
            stopOpacity={mode === 'light' ? 0.22 : 0.17}
          />
          <Stop offset="1" stopColor={glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#myb-wash-2-${mode})`} />
      <Rect width="100%" height="100%" fill={`url(#myb-glow-2-${mode})`} />
    </Svg>
  );
}

/** Fades the field and the glow into the page at the top and bottom. */
function EdgeFade({ mode }: { mode: Mode }) {
  const page = PAGE[mode];
  // Wider than the stage so the emoji past its edges on wide phones fade too.
  return (
    <Svg
      style={{
        position: 'absolute',
        left: -200,
        top: 0,
        width: ART_WIDTH + 400,
        height: ART_HEIGHT,
      }}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id={`myb-fade-${mode}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={page} stopOpacity={1} />
          <Stop offset="0.2" stopColor={page} stopOpacity={0} />
          <Stop offset="0.61" stopColor={page} stopOpacity={0} />
          <Stop offset="0.94" stopColor={page} stopOpacity={1} />
          <Stop offset="1" stopColor={page} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#myb-fade-${mode})`} />
    </Svg>
  );
}

/**
 * The picture for the Meet your Tlonbot slides: on slide 1 the frosted bot
 * floats over a field of emoji; on slide 2 it sits under a frosted glass dome.
 */
export function MeetYourBotArt({
  slide,
  width,
}: {
  slide: Slide;
  width: number;
}) {
  const mode: Mode = useIsDarkMode() ? 'dark' : 'light';
  const reduceMotion = useReducedMotion();
  return (
    <View
      style={{
        position: 'absolute',
        left: (width - ART_WIDTH) / 2,
        top: -6,
        width: ART_WIDTH,
        height: ART_HEIGHT,
        backgroundColor: PAGE[mode],
      }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        slide === 1
          ? 'Your Tlonbot: a frosted green tile with a smile'
          : 'Your Tlonbot under a frosted glass dome'
      }
    >
      <EmojiField mode={mode} />
      <Halo slide={slide} mode={mode} />
      <EdgeFade mode={mode} />
      {slide === 1 ? (
        <FloatingBot mode={mode} reduceMotion={reduceMotion} />
      ) : (
        <DomedBot mode={mode} reduceMotion={reduceMotion} />
      )}
    </View>
  );
}
