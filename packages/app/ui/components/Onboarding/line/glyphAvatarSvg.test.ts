import { describe, expect, it } from 'vitest';

import {
  AVATAR_GLYPHS,
  AVATAR_GLYPH_IDS,
  isAvatarGlyphId,
} from './avatarGlyphs';
import { glyphAvatarSvg } from './glyphAvatarSvg';

describe('glyph avatars', () => {
  it('draws yours light on dark and the Tlonbot’s dark on light', () => {
    const yours = glyphAvatarSvg('sam', 'you', 512);
    const bot = glyphAvatarSvg('sam', 'bot', 512);
    expect(yours).toContain('<rect width="512" height="512" fill="#1A1818"/>');
    expect(bot).toContain('<rect width="512" height="512" fill="#FFFFFF"/>');
  });

  it('draws every part of each glyph', () => {
    for (const id of AVATAR_GLYPH_IDS) {
      const svg = glyphAvatarSvg(id, 'you');
      const parts = svg.match(/<(path|circle) /g) ?? [];
      expect(parts).toHaveLength(1 + AVATAR_GLYPHS[id].details.length);
    }
  });

  it('only accepts the four glyphs', () => {
    expect(isAvatarGlyphId('pel')).toBe(true);
    expect(isAvatarGlyphId('zod')).toBe(false);
    expect(isAvatarGlyphId(undefined)).toBe(false);
  });
});
