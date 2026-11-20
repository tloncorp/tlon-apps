import {
  AVATAR_GLYPHS,
  type AvatarGlyphId,
  GLYPH_SIZE,
  type GlyphShape,
} from './avatarGlyphs';

const INK = '#1A1818';
const PAPER = '#FFFFFF';
/** As on Profile's tiles: a 45 pt glyph in a 72 pt square. */
const GLYPH_SHARE = 45 / 72;

function shape(
  part: GlyphShape,
  fill: string,
  stroke: string,
  strokeWidth: number
) {
  const paint = `fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
  return part.kind === 'circle'
    ? `<circle cx="${part.cx}" cy="${part.cy}" r="${part.r}" ${paint}/>`
    : `<path d="${part.d}"${part.evenOdd ? ' fill-rule="evenodd"' : ''} ${paint}/>`;
}

/**
 * The avatar a glyph pick becomes, as an SVG square. Yours is the picked tile
 * from Profile: a light glyph on dark. The Tlonbot's is how the drawings show
 * it: a dark glyph on light.
 */
export function glyphAvatarSvg(
  glyph: AvatarGlyphId,
  who: 'you' | 'bot',
  pixels = 512
) {
  const background = who === 'you' ? INK : PAPER;
  const body = who === 'you' ? PAPER : INK;
  const line = who === 'you' ? INK : PAPER;
  // The glyph's lines are 2 pt on Profile's 45 pt glyph, 1.6 pt in the bot
  // tiles; in glyph units that's this weight at any size.
  const weight = (who === 'you' ? 2 : 1.6) / (45 / GLYPH_SIZE);
  const size = pixels * GLYPH_SHARE;
  const offset = (pixels - size) / 2;
  const { body: outline, details } = AVATAR_GLYPHS[glyph];
  const parts = [
    shape(outline, body, line, weight),
    ...details.map((detail) =>
      detail.role === 'fill'
        ? shape(detail, line, 'none', 0)
        : shape(detail, 'none', line, weight)
    ),
  ].join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${pixels} ${pixels}">` +
    `<rect width="${pixels}" height="${pixels}" fill="${background}"/>` +
    `<g transform="translate(${offset} ${offset}) scale(${size / GLYPH_SIZE})">${parts}</g>` +
    `</svg>`
  );
}
