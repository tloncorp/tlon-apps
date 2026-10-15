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

type Mode = 'light' | 'dark';
type Slide = 1 | 2;

const CHIP_TINT: Record<Slide, Record<Mode, [string, string]>> = {
  1: {
    light: ['rgba(220,255,210,0.55)', 'rgba(170,230,160,0.35)'],
    dark: ['rgba(205,250,195,0.78)', 'rgba(150,215,140,0.6)'],
  },
  2: {
    light: ['rgba(195,218,255,0.92)', 'rgba(130,176,245,0.82)'],
    dark: ['rgba(215,230,255,0.78)', 'rgba(150,185,245,0.6)'],
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
          withDelay(7600, withTiming(-1.8, { duration: 1900, easing })),
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

function Face({
  width,
  reduceMotion,
}: {
  width: number;
  reduceMotion: boolean;
}) {
  const unit = width / 80;
  const height = width * 0.875;
  const blink = useBlink(reduceMotion);
  const glance = useGlance(reduceMotion);
  const glanceStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: glance.value * unit }],
  }));
  const blinkStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: blink.value }],
  }));
  const eye = (x: number) => ({
    position: 'absolute' as const,
    left: (40 + x) * unit - 3.5 * unit,
    top: 11.5 * unit,
    width: 7 * unit,
    height: 21 * unit,
    borderRadius: 3.5 * unit,
    backgroundColor: '#16181D',
  });
  return (
    <View style={{ width, height }}>
      <Animated.View style={[StyleSheet.absoluteFill, glanceStyle]}>
        <Animated.View style={[eye(-13), blinkStyle]} />
        <Animated.View style={[eye(13), blinkStyle]} />
      </Animated.View>
      <Svg width={width} height={height} viewBox="-40 -35 80 70">
        <Path
          d="M-21 10c11 10 31 10 42 0"
          stroke="#16181D"
          strokeWidth={7}
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
  radius,
  reduceMotion,
}: {
  slide: Slide;
  mode: Mode;
  size: number;
  radius: number;
  reduceMotion: boolean;
}) {
  const [from, to] = CHIP_TINT[slide][mode];
  const gradientId = `myb-chip-${slide}-${mode}`;
  return (
    <View
      style={{
        width: size,
        height: size,
        transform: [{ rotate: '-6deg' }],
        shadowColor: mode === 'light' ? '#1E285A' : '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 11,
        shadowOpacity: mode === 'light' ? 0.1 : 0.3,
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor:
            mode === 'light'
              ? 'rgba(255,255,255,0.65)'
              : 'rgba(255,255,255,0.28)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BlurView intensity={40} tint={mode} style={StyleSheet.absoluteFill} />
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
        <Face width={size * 0.46} reduceMotion={reduceMotion} />
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
              radius={44}
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
    ['0', '#FFFFFF', 0.04],
    ['0.7', '#FFFFFF', 0.06],
    ['1', '#FFFFFF', 0.18],
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
          <Chip
            slide={2}
            mode={mode}
            size={106}
            radius={28}
            reduceMotion={reduceMotion}
          />
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
            : 'rgba(255,255,255,0.42)',
        }}
      >
        <BlurView
          intensity={light ? 4 : 10}
          tint={mode}
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
        {light ? (
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
              borderColor: 'rgba(255,255,255,0.9)',
            }}
          />
        ) : null}
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
      {light ? (
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
            opacity={0.95}
          />
          <Path
            d="M205 72A103 103 0 0 1 213 100"
            fill="none"
            stroke="#3C5FA0"
            strokeOpacity={0.09}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </Svg>
      ) : null}

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
              : 'rgba(255,255,255,0.28)',
          }}
        >
          {light ? (
            <Svg style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="myb-base" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FFFFFF" />
                  <Stop offset="1" stopColor="#DDE6F5" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#myb-base)" />
            </Svg>
          ) : (
            <>
              <BlurView
                intensity={40}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: 'rgba(255,255,255,0.09)' },
                ]}
              />
            </>
          )}
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
            opacity: mode === 'light' ? 0.34 : 0.22,
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
        : '#3C783C'
      : mode === 'light'
        ? '#96C4F5'
        : '#3C69AA';
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
  // On light, the emoji are cleared right under the dome so the glass reads
  // clean; outside it the field stays.
  const squash = 190 / 150;
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        {mode === 'light' ? (
          <RadialGradient
            id="myb-wash-2-light"
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
        ) : (
          <RadialGradient
            id="myb-wash-2-dark"
            cx={cx}
            cy={cy}
            r={230}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={wash} stopOpacity={0} />
            <Stop offset="0.278" stopColor={wash} stopOpacity={0.1} />
            <Stop offset="0.513" stopColor={wash} stopOpacity={0.8} />
            <Stop offset="0.713" stopColor={wash} stopOpacity={0.55} />
            <Stop offset="1" stopColor={wash} stopOpacity={0} />
          </RadialGradient>
        )}
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
