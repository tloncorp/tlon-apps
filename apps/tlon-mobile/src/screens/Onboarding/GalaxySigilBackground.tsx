import { useIsFocused } from '@react-navigation/native';
import {
  Atlas,
  Canvas,
  DashPathEffect,
  Fill,
  FilterMode,
  Line,
  LinearGradient,
  type SkColor,
  type SkRSXform,
  Skia,
  useImage,
  useRSXformBuffer,
  useRectBuffer,
  vec,
} from '@shopify/react-native-skia';
import useAppStatus from '@tloncorp/app/hooks/useAppStatus';
import { useTheme } from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import seedrandom from 'seedrandom';

import galaxySilhouettes from '../../../assets/images/galaxy-sigils-silhouettes.png';
import galaxySigils from '../../../assets/images/galaxy-sigils.png';

const logger = createDevLogger('GalaxySigilBackground', false);

// The atlas contains the full-detail sigil-js glyphs in galaxy number order,
// with the original background ink converted to transparency.
const atlasColumns = 16;
const galaxyCount = atlasColumns * atlasColumns;
const particleCount = 32;
const galaxiesPerParticle = galaxyCount / particleCount;
const random = seedrandom('tlon-welcome');
const particles = Array.from({ length: particleCount }, (_, i) => {
  const depth = random();
  return {
    x: ((i % 8) + 0.15 + random() * 0.7) / 8,
    phase: (Math.floor(i / 8) + random()) / 4,
    size: 13 + depth * 19,
    duration: 48 - depth * 24,
    opacity: 0.09 + depth * 0.14,
    sway: 6 + random() * 11,
    angle: random() * Math.PI * 2,
  };
});

function sigilCenter(transform: SkRSXform, tile: number) {
  'worklet';
  const half = tile / 2;
  return {
    x: transform.tx + half * (transform.scos - transform.ssin),
    y: transform.ty + half * (transform.scos + transform.ssin),
  };
}

function GalaxyConnection({
  offset,
  seconds,
  transforms,
  tile,
  width,
  height,
  colors,
}: {
  offset: number;
  seconds: SharedValue<number>;
  transforms: SharedValue<SkRSXform[]>;
  tile: number;
  width: number;
  height: number;
  colors: SkColor[];
}) {
  const connection = useSharedValue({ from: 0, to: 1, start: -2 });
  useAnimatedReaction(
    () => Math.floor((seconds.get() - offset) / 2),
    (beat, previousBeat) => {
      if (beat < 0 || beat === previousBeat) return;
      const visible = transforms
        .get()
        .map((transform, index) => ({ ...sigilCenter(transform, tile), index }))
        .filter(
          ({ x, y }) => x > 12 && x < width - 12 && y > 12 && y < height * 0.7
        );
      if (!visible.length) return;
      const from = visible[Math.floor(Math.random() * visible.length)];
      const nearby = visible.filter(({ x, y }) => {
        const distance = Math.hypot(x - from.x, y - from.y);
        return distance > 42 && distance < Math.min(width * 0.6, 240);
      });
      if (nearby.length) {
        const to = nearby[Math.floor(Math.random() * nearby.length)];
        connection.set({
          from: from.index,
          to: to.index,
          start: beat * 2 + offset + Math.random() * 0.12,
        });
      }
    }
  );
  const age = useDerivedValue(() =>
    Math.max(0, seconds.get() - connection.get().start)
  );
  const gradientColors = useDerivedValue(() => {
    const { from, to } = connection.get();
    return [colors[from], colors[to]];
  });
  const start = useDerivedValue(() =>
    sigilCenter(transforms.get()[connection.get().from], tile)
  );
  const end = useDerivedValue(() =>
    sigilCenter(transforms.get()[connection.get().to], tile)
  );
  const tip = useDerivedValue(() => {
    const a = start.get();
    const b = end.get();
    const travel = Math.min(1, age.get() / 0.22);
    return { x: a.x + (b.x - a.x) * travel, y: a.y + (b.y - a.y) * travel };
  });
  const opacity = useDerivedValue(() => {
    const t = age.get();
    return Math.max(0, Math.min(1, t / 0.22, (1.85 - t) / 0.55));
  });
  return (
    <Line
      p1={start}
      p2={tip}
      strokeWidth={1}
      strokeCap="round"
      opacity={opacity}
    >
      <LinearGradient start={start} end={end} colors={gradientColors} />
      <DashPathEffect intervals={[3, 4]} />
    </Line>
  );
}

export function GalaxySigilBackground({ paused }: { paused: boolean }) {
  const { width, height } = useWindowDimensions();
  const ink = useTheme().primaryText.val;
  const image = useImage(galaxySigils);
  const silhouettes = useImage(galaxySilhouettes);
  const tile = image ? image.width() / atlasColumns : 64;
  const focused = useIsFocused();
  const appStatus = useAppStatus();
  const [reduceMotion, setReduceMotion] = useState(true);
  const seconds = useSharedValue(0);
  const frame = useFrameCallback(({ timeSincePreviousFrame }) => {
    seconds.set(seconds.get() + (timeSincePreviousFrame ?? 0) / 1000);
  }, false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion, (error) =>
      logger.trackError('failed to read reduced motion setting', { error })
    );
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    frame.setActive(
      !!image && focused && appStatus === 'active' && !paused && !reduceMotion
    );
  }, [appStatus, focused, frame, image, paused, reduceMotion]);

  const colors = useMemo(
    () =>
      particles.map(({ opacity }) => {
        const color = Skia.Color(ink);
        color[3] = opacity;
        return color;
      }),
    [ink]
  );

  // Each particle visits eight galaxies, swapping its tile below the screen.
  const sprites = useRectBuffer(particleCount, (rect, i) => {
    'worklet';
    const { phase, duration } = particles[i];
    const pass = Math.floor(phase + seconds.get() / duration);
    const galaxy = i * galaxiesPerParticle + ((i + pass) % galaxiesPerParticle);
    rect.setXYWH(
      (galaxy % atlasColumns) * tile,
      Math.floor(galaxy / atlasColumns) * tile,
      tile,
      tile
    );
  });
  const transforms = useRSXformBuffer(particleCount, (transform, i) => {
    'worklet';
    const p = particles[i];
    const time = seconds.get();
    const progress = (p.phase + time / p.duration) % 1;
    const wave = Math.sin(p.angle + time * 0.22);
    const x = p.x * (width - p.size) + p.sway * wave;
    const margin = p.size * 1.1;
    const y = progress * (height + 2 * margin) - margin;
    const scale = p.size / tile;
    transform.set(
      scale * Math.cos(wave * 0.1),
      scale * Math.sin(wave * 0.1),
      x,
      y
    );
  });

  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {image &&
        silhouettes &&
        !reduceMotion &&
        [0, 0.5, 1, 1.5].map((offset) => (
          <GalaxyConnection
            key={offset}
            offset={offset}
            seconds={seconds}
            transforms={transforms}
            tile={tile}
            width={width}
            height={height}
            colors={colors}
          />
        ))}
      {/* Erase the lines under each solid outline, including the sigil's interior markings. */}
      {!reduceMotion && silhouettes && (
        <Atlas
          image={silhouettes}
          sprites={sprites}
          transforms={transforms}
          blendMode="dstOut"
          sampling={{ filter: FilterMode.Linear }}
        />
      )}
      <Atlas
        image={image}
        sprites={sprites}
        transforms={transforms}
        colors={colors}
        colorBlendMode="modulate"
        sampling={{ filter: FilterMode.Linear }}
      />
      <Fill blendMode="dstIn">
        <LinearGradient
          start={vec(0, height * 0.54)}
          end={vec(0, height * 0.9)}
          colors={['black', 'transparent']}
        />
      </Fill>
    </Canvas>
  );
}
