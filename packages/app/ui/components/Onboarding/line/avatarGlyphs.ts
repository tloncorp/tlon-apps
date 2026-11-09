// The four avatar glyphs Profile offers, drawn on a 128-unit square. Each has
// a body shape and details inside it: lines, and for some a filled piece.
// Traced from the onboarding design canvas.

export type GlyphShape =
  | { kind: 'path'; d: string; evenOdd?: boolean }
  | { kind: 'circle'; cx: number; cy: number; r: number };

export type GlyphDetail = GlyphShape & { role: 'line' | 'fill' };

export type GlyphDefinition = { body: GlyphShape; details: GlyphDetail[] };

export const AVATAR_GLYPH_IDS = ['sam', 'pel', 'pal', 'net'] as const;
export type AvatarGlyphId = (typeof AVATAR_GLYPH_IDS)[number];

export const GLYPH_SIZE = 128;

export const AVATAR_GLYPHS: Record<AvatarGlyphId, GlyphDefinition> = {
  sam: {
    body: {
      kind: 'path',
      d: 'M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z',
    },
    details: [
      { kind: 'circle', cx: 64, cy: 64, r: 48, role: 'line' },
      { kind: 'path', d: 'M64 0L64 128', role: 'line' },
      {
        kind: 'path',
        d: 'M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z',
        evenOdd: true,
        role: 'fill',
      },
    ],
  },
  pel: {
    body: {
      kind: 'path',
      d: 'M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z',
    },
    details: [
      { kind: 'circle', cx: 64, cy: 64, r: 32, role: 'line' },
      { kind: 'path', d: 'M112 64C112 37.4903 90.5097 16 64 16', role: 'line' },
    ],
  },
  pal: {
    body: {
      kind: 'path',
      d: 'M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z',
    },
    details: [
      { kind: 'path', d: 'M128 0L0 128', role: 'line' },
      {
        kind: 'path',
        d: 'M128 96C101.492 96 77.4939 85.2564 60.1217 67.8862',
        role: 'line',
      },
      {
        kind: 'path',
        d: 'M128 64C110.328 64 94.3287 56.8374 82.7471 45.2568',
        role: 'line',
      },
      {
        kind: 'path',
        d: 'M128 32.3716C119.164 32.3716 111.164 28.7903 105.374 23',
        role: 'line',
      },
    ],
  },
  net: {
    body: { kind: 'circle', cx: 64, cy: 64, r: 64 },
    details: [{ kind: 'path', d: 'M64 64L64 128', role: 'line' }],
  },
};

export function isAvatarGlyphId(value: unknown): value is AvatarGlyphId {
  return (AVATAR_GLYPH_IDS as readonly unknown[]).includes(value);
}
