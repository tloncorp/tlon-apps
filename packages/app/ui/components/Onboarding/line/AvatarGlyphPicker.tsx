import { Pressable, Text } from '@tloncorp/ui';
import * as db from '@tloncorp/shared/db';
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

/** The glyph picked on Profile, for drawing the Tlonbot. Sam until one is. */
export function useOnboardingGlyph(): AvatarGlyphId {
  const picked = db.onboardingAvatar.useValue();
  return isAvatarGlyphId(picked?.glyph) ? picked.glyph : AVATAR_GLYPH_IDS[0];
}

export function AvatarGlyphTile({
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
