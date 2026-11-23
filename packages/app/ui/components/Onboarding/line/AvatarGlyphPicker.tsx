import { Pressable, Text } from '@tloncorp/ui';
import * as db from '@tloncorp/shared/db';
import { useEffect, useRef } from 'react';
import { PixelRatio, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { XStack, YStack } from 'tamagui';

import {
  AVATAR_GLYPH_IDS,
  type AvatarGlyphId,
  PICKED_GLYPH_LINE,
  isAvatarGlyphId,
} from './avatarGlyphs';
import {
  GLYPH_IN_TILE,
  GlyphMark,
  LINE,
  LINE_TILE_RADIUS,
  useLineColors,
} from './lineKit';

/** The row spans the name field's width, its tiles this far apart. */
const ROW_MARGIN = 24;
const TILE_GAP = 12;
/**
 * The canvas's pick: a 0.12 s crossfade on CSS `ease-out`, so the tile is
 * solid by the bottom of the press.
 */
const PICK_FADE_MS = 120;
const CSS_EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
/**
 * The pick's bounce, from the tile's center: a press to 95% in 80 ms, then a
 * spring back from rest (damping ratio 0.5) that overshoots once, to about
 * 100.8%, and settles in about 0.3 s.
 */
const PICK_PRESS = {
  duration: 80,
  easing: Easing.bezier(0.2, 0.6, 0.4, 1),
};
const PICK_RELEASE = { mass: 1, stiffness: 711, damping: 26.7 };

/** The glyph picked on Profile, for drawing the Tlonbot. Sam until one is. */
export function useOnboardingGlyph(): AvatarGlyphId {
  const picked = db.onboardingAvatar.useValue();
  return isAvatarGlyphId(picked?.glyph) ? picked.glyph : AVATAR_GLYPH_IDS[0];
}

/**
 * A tile crossfades between outlined and solid when it's picked, as on the
 * canvas, with no dip while it's pressed. A newly picked tile also bounces;
 * the pick it starts with doesn't. Reduce Motion skips both.
 */
export function AvatarGlyphTile({
  glyph,
  selected,
  size,
}: {
  glyph: AvatarGlyphId;
  selected: boolean;
  size: number;
}) {
  const reduceMotion = useReducedMotion();
  const picked = useSharedValue(selected ? 1 : 0);
  const scale = useSharedValue(1);
  const wasSelected = useRef(selected);
  useEffect(() => {
    const justPicked = selected && !wasSelected.current;
    wasSelected.current = selected;
    const target = selected ? 1 : 0;
    if (reduceMotion) {
      picked.set(target);
      return;
    }
    picked.set(
      withTiming(target, { duration: PICK_FADE_MS, easing: CSS_EASE_OUT })
    );
    if (justPicked) {
      scale.set(
        withSequence(withTiming(0.95, PICK_PRESS), withSpring(1, PICK_RELEASE))
      );
    }
  }, [picked, reduceMotion, scale, selected]);
  const pickedStyle = useAnimatedStyle(() => ({ opacity: picked.value }));
  const unpickedStyle = useAnimatedStyle(() => ({ opacity: 1 - picked.value }));
  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[{ width: size, height: size }, bounceStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, unpickedStyle]}>
        <TileFace glyph={glyph} selected={false} size={size} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, pickedStyle]}>
        <TileFace glyph={glyph} selected size={size} />
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
  const glyphSize = size * GLYPH_IN_TILE;
  const inset = (size - glyphSize) / 2;
  return (
    <Svg width={size} height={size}>
      {selected ? (
        <Rect width={size} height={size} rx={LINE_TILE_RADIUS} fill={ink} />
      ) : (
        <Rect
          x={LINE / 2}
          y={LINE / 2}
          width={size - LINE}
          height={size - LINE}
          rx={LINE_TILE_RADIUS}
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
        lineWidth={PICKED_GLYPH_LINE}
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
  const { width } = useWindowDimensions();
  const count = AVATAR_GLYPH_IDS.length;
  // Whole pixels: a tile's canvas at a fractional size cuts off its right
  // and bottom lines. The row spreads what's left over across its gaps.
  const scale = PixelRatio.get();
  const tile =
    Math.floor(
      ((width - 2 * ROW_MARGIN - (count - 1) * TILE_GAP) / count) * scale
    ) / scale;
  return (
    <YStack gap={8}>
      <Text
        marginHorizontal={40}
        fontSize={14}
        lineHeight={20}
        letterSpacing={-0.187}
        color="$secondaryText"
        nativeID="onboarding-avatar-label"
      >
        Avatar
      </Text>
      <XStack
        marginHorizontal={ROW_MARGIN}
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
            <AvatarGlyphTile
              glyph={glyph}
              selected={value === glyph}
              size={tile}
            />
          </Pressable>
        ))}
      </XStack>
    </YStack>
  );
}
