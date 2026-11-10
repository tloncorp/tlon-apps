import { Pressable, Text } from '@tloncorp/ui';
import * as db from '@tloncorp/shared/db';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
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
import { GlyphMark, LINE, useLineColors } from './lineKit';

const TILE = 72;
const TILE_RADIUS = 12;
const GLYPH = 45;
/** The canvas's pick: a 0.2 s crossfade on CSS `ease`. */
const PICK_FADE_MS = 200;
const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const CSS_EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
/** The picked tile rests this much larger than the others. */
const PICKED_SCALE = 1.08;
/**
 * The pick bounce, 0.3 s from the tile's center: one small dip, then a small
 * overshoot past the picked size. Each step's scale and length, from the
 * canvas's keyframes at 35, 70 and 100%.
 */
const PICK_BOUNCE: [number, number][] = [
  [0.96, 105],
  [PICKED_SCALE * 1.02, 105],
  [PICKED_SCALE, 90],
];

/** The glyph picked on Profile, for drawing the Tlonbot. Sam until one is. */
export function useOnboardingGlyph(): AvatarGlyphId {
  const picked = db.onboardingAvatar.useValue();
  return isAvatarGlyphId(picked?.glyph) ? picked.glyph : AVATAR_GLYPH_IDS[0];
}

/**
 * A tile crossfades between outlined and solid when it's picked, as on the
 * canvas, with no dip while it's pressed, and the picked tile sits a little
 * larger. A newly picked tile bounces up to that size and the old pick eases
 * back; the pick it starts with doesn't move. Reduce Motion skips the motion.
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
  const scale = useSharedValue(selected ? PICKED_SCALE : 1);
  const wasSelected = useRef(selected);
  useEffect(() => {
    const justPicked = selected && !wasSelected.current;
    wasSelected.current = selected;
    const target = selected ? 1 : 0;
    if (reduceMotion) {
      picked.set(target);
      scale.set(selected ? PICKED_SCALE : 1);
      return;
    }
    picked.set(
      withTiming(target, { duration: PICK_FADE_MS, easing: CSS_EASE })
    );
    if (justPicked) {
      scale.set(
        withSequence(
          ...PICK_BOUNCE.map(([to, duration]) =>
            withTiming(to, { duration, easing: CSS_EASE_OUT })
          )
        )
      );
    } else if (!selected) {
      scale.set(withTiming(1, { duration: PICK_FADE_MS, easing: CSS_EASE }));
    }
  }, [picked, reduceMotion, scale, selected]);
  const pickedStyle = useAnimatedStyle(() => ({ opacity: picked.value }));
  const unpickedStyle = useAnimatedStyle(() => ({ opacity: 1 - picked.value }));
  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[{ width: TILE, height: TILE }, bounceStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, unpickedStyle]}>
        <TileFace glyph={glyph} selected={false} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, pickedStyle]}>
        <TileFace glyph={glyph} selected />
      </Animated.View>
    </Animated.View>
  );
}

function TileFace({
  glyph,
  selected,
}: {
  glyph: AvatarGlyphId;
  selected: boolean;
}) {
  const { ink, paper } = useLineColors();
  const inset = (TILE - GLYPH) / 2;
  return (
    <Svg width={TILE} height={TILE}>
      {selected ? (
        <Rect width={TILE} height={TILE} rx={TILE_RADIUS} fill={ink} />
      ) : (
        <Rect
          x={LINE / 2}
          y={LINE / 2}
          width={TILE - LINE}
          height={TILE - LINE}
          rx={TILE_RADIUS}
          fill={paper}
          stroke={ink}
          strokeWidth={LINE}
        />
      )}
      <GlyphMark
        glyph={glyph}
        x={inset}
        y={inset}
        size={GLYPH}
        variant={selected ? 'inverse' : 'line'}
        lineWidth={2}
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
        marginHorizontal="$2xl"
        justifyContent="space-between"
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
