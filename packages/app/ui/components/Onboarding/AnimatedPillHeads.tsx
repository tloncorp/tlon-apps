import { type ComponentClass, useEffect } from 'react';
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
import Svg, { G, type GProps, Path } from 'react-native-svg';
import { useTheme } from 'tamagui';

import { HEADS, SPARKLES, VIEW_BOX } from './pillHeadsParts';

// The native group takes its transform as `matrix` ([a, b, c, d, e, f], as in
// SVG's matrix()). Its JS props don't list it, so it's added here; that lets
// each part move by changing six numbers instead of redrawing its path.
type MatrixGProps = GProps & { matrix?: number[] };
const AnimatedG = Animated.createAnimatedComponent(
  G as unknown as ComponentClass<MatrixGProps>
);

// The loop runs 360 frames over seven seconds. Frame 0 is the drawing as it
// is, which is all that shows with Reduce Motion on.
const LOOP_FRAMES = 360;
const LOOP_MS = 7000;

const HOLD = 0;
const EASE_IN = 1;
const EASE_OUT = 2;
const EASE_IN_OUT = 3;
type Ease = typeof HOLD | typeof EASE_IN | typeof EASE_OUT | typeof EASE_IN_OUT;
// [frame, value, easing toward the next key]
type Key = [number, number, Ease];

const easeIn = Easing.bezierFn(0.55, 0, 0.9, 0.5);
const easeOut = Easing.bezierFn(0.15, 0.5, 0.35, 1);
const easeInOut = Easing.bezierFn(0.42, 0, 0.58, 1);

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

// [amount, period in frames, phase]. Periods divide the loop and phases are 0
// or a half turn, so every wave is 0 at frame 0 and centred on the drawing.
type Wave = [number, number, number];

function drift([amount, period, phase]: Wave, frame: number): number {
  'worklet';
  return amount * Math.sin(2 * Math.PI * (frame / period + phase));
}

// A track rests at its first value from frame 0 until its first key.
function track(...parts: Key[][]): Key[] {
  return [[0, parts[0][0][1], HOLD], ...parts.flat()];
}

// A small sink, a soft rise and a soft landing, squashing a little at each end.
function hop(at: number, height: number, squash: number) {
  const dy: Key[] = [
    [at, 0, EASE_IN_OUT],
    [at + 7, 1, EASE_OUT],
    [at + 18, -height, EASE_IN_OUT],
    [at + 32, 0, HOLD],
  ];
  const sy: Key[] = [
    [at, 1, EASE_IN_OUT],
    [at + 7, 1 - squash, EASE_OUT],
    [at + 14, 1 + squash * 0.5, EASE_IN_OUT],
    [at + 24, 1, EASE_IN_OUT],
    [at + 33, 1 - squash * 0.5, EASE_IN_OUT],
    [at + 42, 1, HOLD],
  ];
  return { dy, sy };
}

// Widen as the height drops, so a squashed head keeps its size.
function keepVolume(sy: Key[]): Key[] {
  return sy.map(([at, value, ease]) => [at, 1 - (value - 1) * 0.6, ease]);
}

// Snap shut, a beat closed, ease open.
function blink(at: number): Key[] {
  return [
    [at, 1, EASE_IN],
    [at + 3, 0.1, HOLD],
    [at + 5, 0.1, EASE_OUT],
    [at + 12, 1, HOLD],
  ];
}

// Pull in a little, swell past full size, settle back.
function pop(at: number, peak: number): Key[] {
  return [
    [at, 1, EASE_IN_OUT],
    [at + 6, 0.93, EASE_OUT],
    [at + 18, peak, EASE_IN_OUT],
    [at + 34, 1, HOLD],
  ];
}

// A turn that drifts back.
function spin(at: number, degrees: number): Key[] {
  return [
    [at, 0, EASE_OUT],
    [at + 28, degrees, EASE_IN_OUT],
    [at + 80, 0, HOLD],
  ];
}

function squint(at: number, until: number): Key[] {
  return [
    [at, 1, EASE_IN_OUT],
    [at + 7, 0.75, HOLD],
    [until, 0.75, EASE_IN_OUT],
    [until + 12, 1, HOLD],
  ];
}

type HeadName = (typeof HEADS)[number]['name'];
type SparkleName = (typeof SPARKLES)[number]['name'];
// dy in drawing units; rot in degrees, clockwise; sx and sy as scales.
type HeadMotion = { dy?: Key[]; rot?: Key[]; sx?: Key[]; sy?: Key[] };
type FeatureMotion = { tx?: Key[]; ty?: Key[]; sx?: Key[]; sy?: Key[] };

// Each head turns around one point and squashes around its base, in drawing
// units.
const TURN_PIVOTS: Record<HeadName, { x: number; y: number }> = {
  b: { x: 236, y: 560 },
  r: { x: 652, y: 478 },
  tl: { x: 468, y: 290 },
};
const BASES: Record<HeadName, { x: number; y: number }> = {
  b: { x: 236, y: 566 },
  r: { x: 610, y: 486 },
  tl: { x: 360, y: 318 },
};

// Under everything, each head floats, out of step with the others: it bobs up
// and down, drifts a little side to side (so it traces a soft figure-eight)
// and sways.
const FLOAT: Record<HeadName, { rise: Wave[]; side: Wave; sway: Wave }> = {
  b: {
    rise: [
      [3.5, 360, 0],
      [1, 90, 0.5],
    ],
    side: [1.3, 120, 0],
    sway: [0.45, 360, 0.5],
  },
  r: {
    rise: [
      [3.8, 180, 0],
      [1, 360, 0.5],
    ],
    side: [1.6, 360, 0.5],
    sway: [0.6, 180, 0.5],
  },
  tl: {
    rise: [
      [4, 360, 0.5],
      [1, 120, 0],
    ],
    side: [1.6, 180, 0],
    sway: [0.5, 360, 0],
  },
};
// The sparkles float too: [rise, side, turn in degrees].
const SPARKLE_FLOAT: Record<SparkleName, [Wave, Wave, Wave]> = {
  top: [
    [2.8, 180, 0.5],
    [1.4, 360, 0],
    [4, 360, 0.5],
  ],
  left: [
    [2.8, 120, 0],
    [1.4, 180, 0.5],
    [4, 360, 0],
  ],
  bottom: [
    [2.8, 360, 0.5],
    [1.4, 120, 0],
    [4, 180, 0],
  ],
};
// Faces trail their head by a few frames when it hops or leans.
const TRAIL_FRAMES = 4;
const TRAIL_AMOUNT = 0.55;

// The story, about seven seconds: the right head goes "oh!" (frames 24 to 82).
// The top-left one reacts, eyes first, then a slow lean, a blink, and back (84
// to 178). The bottom one raises its brows and nods (180 to 240). Then all
// three laugh, one after another (244 to 306), and rest.
const rOh = hop(24, 6, 0.02);
const rLaugh = hop(244, 3.5, 0.015);
const tlLaugh = hop(254, 3, 0.015);
const bLaugh = hop(264, 3, 0.015);
const rSy = track(rOh.sy, rLaugh.sy);
const tlSy = track(tlLaugh.sy);
const bSy = track(bLaugh.sy);

const HEAD_MOTION: Record<HeadName, HeadMotion> = {
  r: {
    dy: track(rOh.dy, rLaugh.dy),
    sy: rSy,
    sx: keepVolume(rSy),
    rot: track([
      [26, 0, EASE_IN_OUT],
      [44, -1.6, EASE_IN_OUT],
      [66, 0.2, EASE_IN_OUT],
      [80, 0, HOLD],
    ]),
  },
  tl: {
    dy: track(
      [
        [90, 0, EASE_IN_OUT],
        [110, 1, HOLD],
        [150, 1, EASE_IN_OUT],
        [168, 0, HOLD],
      ],
      tlLaugh.dy
    ),
    sy: tlSy,
    sx: keepVolume(tlSy),
    rot: track([
      [90, 0, EASE_IN_OUT],
      [110, -2.4, EASE_IN_OUT],
      [150, -2.6, EASE_IN_OUT],
      [166, 0.2, EASE_IN_OUT],
      [178, 0, HOLD],
    ]),
  },
  b: {
    dy: track(
      [
        [190, 0, EASE_IN_OUT],
        [200, 2, EASE_IN_OUT],
        [214, 0, HOLD],
      ],
      bLaugh.dy
    ),
    sy: bSy,
    sx: keepVolume(bSy),
    rot: track([
      [190, 0, EASE_IN_OUT],
      [200, 1.5, EASE_IN_OUT],
      [214, 0, HOLD],
    ]),
  },
};

const R_EYES: FeatureMotion = {
  ty: track([
    [30, 0, EASE_OUT],
    [42, -3, HOLD],
    [58, -3, EASE_IN_OUT],
    [74, 0, HOLD],
  ]),
  sy: track(
    [
      [30, 1, EASE_OUT],
      [42, 1.04, HOLD],
      [58, 1.04, EASE_IN_OUT],
      [74, 1, HOLD],
    ],
    squint(248, 284),
    blink(324)
  ),
};
const R_MOUTH = track(
  [
    [28, 1, EASE_IN_OUT],
    [34, 0.92, EASE_OUT],
    [44, 1.2, EASE_IN_OUT],
    [56, 1.13, HOLD],
    [66, 1.13, EASE_IN_OUT],
    [82, 1, HOLD],
  ],
  [
    [248, 1, EASE_IN_OUT],
    [258, 1.08, EASE_IN_OUT],
    [276, 1, HOLD],
  ]
);
const TL_EYES: FeatureMotion = {
  tx: track([
    [84, 0, EASE_OUT],
    [94, 5, HOLD],
    [146, 5, EASE_IN_OUT],
    [158, 0, HOLD],
  ]),
  ty: track([
    [84, 0, EASE_OUT],
    [94, 1.6, HOLD],
    [146, 1.6, EASE_IN_OUT],
    [158, 0, HOLD],
  ]),
  sy: track(blink(122), squint(258, 292)),
};

const FEATURE_MOTION: Partial<Record<string, FeatureMotion>> = {
  'r.eyeL': R_EYES,
  'r.eyeR': R_EYES,
  'r.mouth': { sx: R_MOUTH, sy: R_MOUTH },
  'tl.eyeL': TL_EYES,
  'tl.eyeR': TL_EYES,
  'tl.mouth': {
    sx: track([
      [94, 1, EASE_OUT],
      [108, 1.06, HOLD],
      [148, 1.06, EASE_IN_OUT],
      [162, 1, HOLD],
    ]),
    ty: track([
      [94, 0, EASE_OUT],
      [108, -0.8, HOLD],
      [148, -0.8, EASE_IN_OUT],
      [162, 0, HOLD],
    ]),
  },
  'b.brows': {
    ty: track([
      [180, 0, EASE_OUT],
      [192, -5.5, EASE_IN_OUT],
      [226, -5, EASE_IN_OUT],
      [240, 0, HOLD],
    ]),
  },
  'b.mouth': {
    sx: track([
      [192, 1, EASE_OUT],
      [204, 1.04, HOLD],
      [226, 1.04, EASE_IN_OUT],
      [238, 1, HOLD],
    ]),
  },
};

const SPARKLE_MOTION: Record<SparkleName, { scale: Key[]; turn: Key[] }> = {
  top: { scale: track(pop(38, 1.1)), turn: track(spin(38, 8)) },
  left: { scale: track(pop(196, 1.08)), turn: track(spin(196, -7)) },
  bottom: { scale: track(pop(268, 1.1)), turn: track(spin(268, 8)) },
};

const STILL: Key[] = [[0, 0, HOLD]];
const ONE: Key[] = [[0, 1, HOLD]];

export function AnimatedPillHeads() {
  const theme = useTheme();
  const ink = theme.primaryText.val;
  // The screen's background, so a head hides the lines behind it.
  const paper = theme.secondaryBackground.val;
  const reduceMotion = useReducedMotion();
  const frame = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    frame.set(
      withRepeat(
        withTiming(LOOP_FRAMES, {
          duration: LOOP_MS,
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
      viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`}
    >
      {SPARKLES.map((sparkle) => (
        <Sparkle
          key={sparkle.name}
          sparkle={sparkle}
          frame={frame}
          color={ink}
        />
      ))}
      {HEADS.map((head, index) => (
        <Head
          key={head.name}
          head={head}
          // The back head has nothing behind it to hide.
          hides={index > 0}
          frame={frame}
          ink={ink}
          paper={paper}
        />
      ))}
    </Svg>
  );
}

function Head({
  head,
  hides,
  frame,
  ink,
  paper,
}: {
  head: (typeof HEADS)[number];
  hides: boolean;
  frame: SharedValue<number>;
  ink: string;
  paper: string;
}) {
  const { x, y } = head;
  const pivot = TURN_PIVOTS[head.name];
  const base = BASES[head.name];
  const { rise, side, sway } = FLOAT[head.name];
  const motion = HEAD_MOTION[head.name];
  const dyKeys = motion.dy ?? STILL;
  const rotKeys = motion.rot ?? STILL;
  const sxKeys = motion.sx ?? ONE;
  const syKeys = motion.sy ?? ONE;

  const animatedProps = useAnimatedProps<MatrixGProps>(() => {
    const f = frame.get();
    let dy = sample(dyKeys, f);
    for (const layer of rise) {
      dy += drift(layer, f);
    }
    const sx = sample(sxKeys, f);
    const sy = sample(syKeys, f);
    const angle = ((sample(rotKeys, f) + drift(sway, f)) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Squash around the base, turn around the pivot, then move.
    const ux = sx * (x - base.x) + base.x - pivot.x;
    const uy = sy * (y - base.y) + base.y - pivot.y;
    return {
      matrix: [
        cos * sx,
        sin * sx,
        -sin * sy,
        cos * sy,
        cos * ux - sin * uy + pivot.x + drift(side, f),
        sin * ux + cos * uy + pivot.y + dy,
      ],
    };
  });

  return (
    <AnimatedG transform={`translate(${x} ${y})`} animatedProps={animatedProps}>
      {hides ? <Path d={head.outline} fill={paper} /> : null}
      <Path d={head.outline + head.holes} fill={ink} fillRule="evenodd" />
      {head.features.map((feature) => (
        <Feature
          key={feature.name}
          feature={feature}
          motion={FEATURE_MOTION[`${head.name}.${feature.name}`] ?? {}}
          headDy={dyKeys}
          frame={frame}
          color={ink}
        />
      ))}
    </AnimatedG>
  );
}

function Feature({
  feature,
  motion,
  headDy,
  frame,
  color,
}: {
  feature: (typeof HEADS)[number]['features'][number];
  motion: FeatureMotion;
  headDy: Key[];
  frame: SharedValue<number>;
  color: string;
}) {
  const { x, y } = feature;
  const txKeys = motion.tx ?? STILL;
  const tyKeys = motion.ty ?? STILL;
  const sxKeys = motion.sx ?? ONE;
  const syKeys = motion.sy ?? ONE;

  const animatedProps = useAnimatedProps<MatrixGProps>(() => {
    const f = frame.get();
    const earlier = (f - TRAIL_FRAMES + LOOP_FRAMES) % LOOP_FRAMES;
    const trail = TRAIL_AMOUNT * (sample(headDy, earlier) - sample(headDy, f));
    return {
      matrix: [
        sample(sxKeys, f),
        0,
        0,
        sample(syKeys, f),
        x + sample(txKeys, f),
        y + sample(tyKeys, f) + trail,
      ],
    };
  });

  return (
    <AnimatedG transform={`translate(${x} ${y})`} animatedProps={animatedProps}>
      <Path d={feature.path} fill={color} fillRule="evenodd" />
    </AnimatedG>
  );
}

function Sparkle({
  sparkle,
  frame,
  color,
}: {
  sparkle: (typeof SPARKLES)[number];
  frame: SharedValue<number>;
  color: string;
}) {
  const { x, y } = sparkle;
  const { scale, turn } = SPARKLE_MOTION[sparkle.name];
  const [rise, side, sway] = SPARKLE_FLOAT[sparkle.name];

  const animatedProps = useAnimatedProps<MatrixGProps>(() => {
    const f = frame.get();
    const s = sample(scale, f);
    const angle = ((sample(turn, f) + drift(sway, f)) * Math.PI) / 180;
    const cos = Math.cos(angle) * s;
    const sin = Math.sin(angle) * s;
    return {
      matrix: [cos, sin, -sin, cos, x + drift(side, f), y + drift(rise, f)],
    };
  });

  return (
    <AnimatedG transform={`translate(${x} ${y})`} animatedProps={animatedProps}>
      <Path d={sparkle.path} fill={color} fillRule="evenodd" />
    </AnimatedG>
  );
}
