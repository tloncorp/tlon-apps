import { useTheme } from '@tloncorp/app/ui';
import { useEffect } from 'react';
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import {
  FEATURES,
  SPEECH_LINES,
  SPEECH_ORIGIN,
  STILL_PATH,
  VIEW_BOX,
} from './arvosDiscussingParts';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The loop runs 240 frames at 60 per second. Frame 0 is the still drawing,
// which is all that shows with Reduce Motion on.
const FPS = 60;
const LOOP_FRAMES = 240;

const HOLD = 0;
const EASE_IN = 1;
const EASE_OUT = 2;
const EASE_IN_OUT = 3;
type Ease = typeof HOLD | typeof EASE_IN | typeof EASE_OUT | typeof EASE_IN_OUT;
// [frame, value, easing toward the next key]
type Key = [number, number, Ease];

const easeIn = Easing.bezierFn(0.5, 0, 0.9, 0.6);
const easeOut = Easing.bezierFn(0.2, 0, 0.1, 1);
const easeInOut = Easing.bezierFn(0.45, 0, 0.55, 1);

function sample(keys: Key[], frame: number): number {
  'worklet';
  for (let i = keys.length - 1; i >= 0; i--) {
    const [at, value, ease] = keys[i];
    if (frame < at) {
      continue;
    }
    const next = keys[i + 1];
    if (!next || ease === HOLD) {
      return value;
    }
    const t = (frame - at) / (next[0] - at);
    const eased =
      ease === EASE_IN
        ? easeIn(t)
        : ease === EASE_OUT
          ? easeOut(t)
          : easeInOut(t);
    return value + (next[1] - value) * eased;
  }
  return keys[0][1];
}

// Draws a part's points through the matrix [a c e; b d f].
function toPathData(
  points: number[],
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number
): string {
  'worklet';
  let out = '';
  let i = 0;
  while (i < points.length) {
    const op = points[i++];
    if (op === 3) {
      out += 'Z';
      continue;
    }
    out += op === 0 ? 'M' : op === 1 ? 'L' : 'C';
    const pairs = op === 2 ? 3 : 1;
    for (let p = 0; p < pairs; p++) {
      const x = points[i++];
      const y = points[i++];
      out += `${(a * x + c * y + e).toFixed(2)} ${(b * x + d * y + f).toFixed(2)} `;
    }
  }
  return out;
}

// Speech lines leave toward the listeners (the far end stays put while the
// line shrinks into it), then grow back out of the speaker. Twice a loop,
// each line a few frames after the one before.
function speechKeys(index: number) {
  const s = index * 4;
  const scale: Key[] = [
    [0, 1, HOLD],
    [30 + s, 1, EASE_IN],
    [52 + s, 0, HOLD],
    [66 + s, 0, EASE_OUT],
    [86 + s, 1, HOLD],
    [126 + s, 1, EASE_IN],
    [148 + s, 0, HOLD],
    [162 + s, 0, EASE_OUT],
    [182 + s, 1, HOLD],
  ];
  const reach = SPEECH_LINES[index].reach;
  const travel: Key[] = [
    [0, 0, HOLD],
    [30 + s, 0, EASE_IN],
    [52 + s, reach, HOLD],
    [56 + s, 0, HOLD],
    [126 + s, 0, EASE_IN],
    [148 + s, reach, HOLD],
    [152 + s, 0, HOLD],
  ];
  return { scale, travel };
}

const SPEECH_KEYS = SPEECH_LINES.map((_, index) => speechKeys(index));

// The head's brows lift as each burst lands.
const BROW_LIFT: Key[] = [
  [0, 0, HOLD],
  [88, 0, EASE_OUT],
  [100, -6, HOLD],
  [120, -6, EASE_IN_OUT],
  [138, 0, HOLD],
  [184, 0, EASE_OUT],
  [196, -6, HOLD],
  [216, -6, EASE_IN_OUT],
  [234, 0, HOLD],
];

function blinkKeys(at: number): Key[] {
  return [
    [0, 1, HOLD],
    [at, 1, EASE_IN],
    [at + 5, 0.1, EASE_OUT],
    [at + 12, 1, HOLD],
  ];
}

const STILL: Key[] = [[0, 0, HOLD]];
const OPEN: Key[] = [[0, 1, HOLD]];

const FEATURE_MOTION: {
  name: keyof typeof FEATURES;
  lift: Key[];
  blink: Key[];
}[] = [
  { name: 'browL', lift: BROW_LIFT, blink: OPEN },
  { name: 'browR', lift: BROW_LIFT, blink: OPEN },
  { name: 'eyeL', lift: STILL, blink: blinkKeys(150) },
  { name: 'eyeR', lift: STILL, blink: blinkKeys(150) },
  { name: 'leftEye', lift: STILL, blink: blinkKeys(42) },
  { name: 'rightEye', lift: STILL, blink: blinkKeys(208) },
];

export function AnimatedArvosDiscussing() {
  const theme = useTheme();
  const color = theme.primaryText.val;
  const reduceMotion = useReducedMotion();
  const frame = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    frame.set(
      withRepeat(
        withTiming(LOOP_FRAMES, {
          duration: (LOOP_FRAMES / FPS) * 1000,
          easing: Easing.linear,
        }),
        -1
      )
    );
    return () => cancelAnimation(frame);
  }, [frame, reduceMotion]);

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`}
    >
      <Path d={STILL_PATH} fill={color} fillRule="evenodd" />
      {SPEECH_LINES.map((_, index) => (
        <SpeechLine key={index} index={index} frame={frame} color={color} />
      ))}
      {FEATURE_MOTION.map((feature) => (
        <Feature key={feature.name} {...feature} frame={frame} color={color} />
      ))}
    </Svg>
  );
}

function SpeechLine({
  index,
  frame,
  color,
}: {
  index: number;
  frame: SharedValue<number>;
  color: string;
}) {
  const { angle, path } = SPEECH_LINES[index];
  const { scale, travel } = SPEECH_KEYS[index];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const animatedProps = useAnimatedProps(() => {
    // Scale along the line's direction only, then slide along it.
    const s = sample(scale, frame.get());
    const t = sample(travel, frame.get());
    const shear = cos * sin * (s - 1);
    return {
      d: toPathData(
        path,
        cos * cos * s + sin * sin,
        shear,
        shear,
        sin * sin * s + cos * cos,
        SPEECH_ORIGIN.x + cos * t,
        SPEECH_ORIGIN.y + sin * t
      ),
    };
  });

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill={color}
      fillRule="evenodd"
    />
  );
}

function Feature({
  name,
  lift,
  blink,
  frame,
  color,
}: {
  name: keyof typeof FEATURES;
  lift: Key[];
  blink: Key[];
  frame: SharedValue<number>;
  color: string;
}) {
  const { x, y, path } = FEATURES[name];

  const animatedProps = useAnimatedProps(() => {
    const dy = sample(lift, frame.get());
    const sy = sample(blink, frame.get());
    return { d: toPathData(path, 1, 0, 0, sy, x, y + dy) };
  });

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill={color}
      fillRule="evenodd"
    />
  );
}
