import { hsla, parseToHsla, readableColorIsBlack } from 'color2k';

// Mirror of landscape's `getDarkColor`. Returns the input color with its HSL
// lightness inverted, which yields a contrasting tone in the same hue. Used
// for app titles drawn over a charge color so they harmonize with the tile
// background.
export function getDarkColor(color: string): string {
  const [h, s, l] = parseToHsla(color);
  return hsla(h, s, 1 - l, 1);
}

// True when the supplied color is light enough that black text reads on it
// better than white. Wraps color2k for callers that don't depend on it.
export function isLightColor(color: string): boolean {
  try {
    return readableColorIsBlack(color);
  } catch {
    return true;
  }
}
