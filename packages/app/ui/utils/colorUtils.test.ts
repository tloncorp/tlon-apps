import { expect, test } from 'vitest';

import { getFallbackSigilColor } from './colorUtils';

test('getFallbackSigilColor is stable for the same ship', () => {
  expect(getFallbackSigilColor('~sitrul-nacwyl')).toBe(
    getFallbackSigilColor('~sitrul-nacwyl')
  );
});

test('getFallbackSigilColor varies across ships', () => {
  expect(getFallbackSigilColor('~sitrul-nacwyl')).not.toBe(
    getFallbackSigilColor('~malmur-halmex')
  );
});

test('getFallbackSigilColor returns an hsl color string', () => {
  expect(getFallbackSigilColor('~sitrul-nacwyl')).toMatch(
    /^hsl\(\d+, 65%, 48%\)$/
  );
});
