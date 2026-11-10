import { Pressable, Text } from '@tloncorp/ui';
import * as db from '@tloncorp/shared/db';
import { useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { XStack, YStack } from 'tamagui';

import {
  AVATAR_GLYPH_IDS,
  type AvatarGlyphId,
  isAvatarGlyphId,
} from './avatarGlyphs';
import { GLYPH_IN_TILE, GlyphMark, LINE, useLineColors } from './lineKit';

const TILE = 72;
/** The picked tile takes this much room, pushing the others along. */
const PICKED_TILE = 88;
/** The row's side margin: the screen's 24 pt gutter. */
const ROW_MARGIN = 24;
const TILE_RADIUS = 12;
/** The solid tile's glyph lines, at TILE. */
const PICKED_GLYPH_LINE = 2;
/** The canvas's pick: a 0.2 s crossfade on CSS `ease`. */
const PICK_FADE_MS = 200;
/** How long the picked tile takes to grow, and the old pick to shrink. */
const PICK_GROW_MS = 250;
const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const CSS_EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
/**
 * The canvas's pick bounce, 0.3 s from the tile's center: one small dip and
 * overshoot. Each step's scale and length, from its keyframes at 35, 70 and
 * 100%.
 */
const PICK_BOUNCE: [number, number][] = [
  [0.96, 105],
  [1.02, 105],
  [1, 90],
];

/** The glyph picked on Profile, for drawing the Tlonbot. Sam until one is. */
export function useOnboardingGlyph(): AvatarGlyphId {
  const picked = db.onboardingAvatar.useValue();
  return isAvatarGlyphId(picked?.glyph) ? picked.glyph : AVATAR_GLYPH_IDS[0];
}

/**
 * A tile crossfades between outlined and solid when it's picked, as on the
 * canvas, with no dip while it's pressed. The picked tile is larger and
 * takes the room it needs; a newly picked one grows with a small bounce while
 * the old pick shrinks back. The pick it starts with doesn't move, and Reduce
 * Motion skips the motion.
 */
export function AvatarGlyphTile({
  glyph,
  selected,
}: {
  glyph: AvatarGlyphId;
  selected: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const picked = useSharedValue(selected ? 1 : 0);
  const size = useSharedValue(selected ? PICKED_TILE : TILE);
  const bounce = useSharedValue(1);
  const wasSelected = useRef(selected);
  useEffect(() => {
    const justPicked = selected && !wasSelected.current;
    wasSelected.current = selected;
    const target = selected ? 1 : 0;
    const targetSize = selected ? PICKED_TILE : TILE;
    if (reduceMotion) {
      picked.set(target);
      size.set(targetSize);
      return;
    }
    picked.set(
      withTiming(target, { duration: PICK_FADE_MS, easing: CSS_EASE })
    );
    size.set(
      withTiming(targetSize, { duration: PICK_GROW_MS, easing: CSS_EASE })
    );
    if (justPicked) {
      bounce.set(
        withSequence(
          ...PICK_BOUNCE.map(([to, duration]) =>
            withTiming(to, { duration, easing: CSS_EASE_OUT })
          )
        )
      );
    }
  }, [bounce, picked, reduceMotion, selected, size]);

  const frameStyle = useAnimatedStyle(() => ({
    width: size.value,
    height: size.value,
  }));
  // Each face is drawn at its own resting size, so it's sharp at rest, and
  // scaled to the tile's current size in between.
  const unpickedStyle = useAnimatedStyle(() => ({
    opacity: 1 - picked.value,
    left: (size.value - TILE) / 2,
    top: (size.value - TILE) / 2,
    transform: [{ scale: (size.value / TILE) * bounce.value }],
  }));
  const pickedStyle = useAnimatedStyle(() => ({
    opacity: picked.value,
    left: (size.value - PICKED_TILE) / 2,
    top: (size.value - PICKED_TILE) / 2,
    transform: [{ scale: (size.value / PICKED_TILE) * bounce.value }],
  }));
  return (
    <Animated.View style={frameStyle}>
      <Animated.View style={[{ position: 'absolute' }, unpickedStyle]}>
        <TileFace glyph={glyph} selected={false} size={TILE} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute' }, pickedStyle]}>
        <TileFace glyph={glyph} selected size={PICKED_TILE} />
      </Animated.View>
    </Animated.View>
  );
}

function TileFace({
  glyph,
  selected,
  size,
}: {
  glyph: AvatarGlyphId;
  selected: boolean;
  size: number;
}) {
  const { ink, paper } = useLineColors();
  const k = size / TILE;
  const glyphSize = size * GLYPH_IN_TILE;
  const inset = (size - glyphSize) / 2;
  return (
    <Svg width={size} height={size}>
      {selected ? (
        <Rect width={size} height={size} rx={TILE_RADIUS * k} fill={ink} />
      ) : (
        <Rect
          x={LINE / 2}
          y={LINE / 2}
          width={size - LINE}
          height={size - LINE}
          rx={TILE_RADIUS * k}
          fill={paper}
          stroke={ink}
          strokeWidth={LINE}
        />
      )}
      <GlyphMark
        glyph={glyph}
        x={inset}
        y={inset}
        size={glyphSize}
        variant={selected ? 'inverse' : 'line'}
        lineWidth={PICKED_GLYPH_LINE * k}
      />
    </Svg>
  );
}

/** Profile's avatar row: four glyphs, one picked. */
export function AvatarGlyphPicker({
  value,
  onChange,
}: {
  value: AvatarGlyphId;
  onChange: (glyph: AvatarGlyphId) => void;
}) {
  // The gap the four tiles would have at their normal size, edge to edge.
  // Kept as the row grows, with the row centered, the picked tile grows about
  // its own middle and pushes the tiles on both sides out by the same amount;
  // the end tiles reach a little past the margins.
  const { width } = useWindowDimensions();
  const count = AVATAR_GLYPH_IDS.length;
  const gap = Math.max(
    0,
    (width - 2 * ROW_MARGIN - count * TILE) / (count - 1)
  );
  return (
    <YStack gap={8}>
      <Text
        marginHorizontal={40}
        fontSize={14}
        lineHeight={20}
        letterSpacing={-0.187}
        color="$primaryText"
        nativeID="onboarding-avatar-label"
      >
        Avatar
      </Text>
      <XStack
        marginHorizontal={ROW_MARGIN}
        // As tall as the picked tile, so the field below stays put while
        // one tile grows and another shrinks.
        height={PICKED_TILE}
        alignItems="center"
        justifyContent="center"
        gap={gap}
        accessibilityRole="radiogroup"
        accessibilityLabelledBy="onboarding-avatar-label"
      >
        {AVATAR_GLYPH_IDS.map((glyph, index) => (
          <Pressable
            key={glyph}
            onPress={() => onChange(glyph)}
            // The pick's crossfade is the feedback; no press dip.
            pressStyle={{ opacity: 1 }}
            accessibilityRole="radio"
            accessibilityLabel={`Avatar ${index + 1} of ${AVATAR_GLYPH_IDS.length}`}
            accessibilityState={{ checked: value === glyph }}
            testID={`onboarding-avatar-${glyph}`}
          >
            <AvatarGlyphTile glyph={glyph} selected={value === glyph} />
          </Pressable>
        ))}
      </XStack>
    </YStack>
  );
}
