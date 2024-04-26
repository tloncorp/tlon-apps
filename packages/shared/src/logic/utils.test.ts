import { describe, expect, it } from 'vitest';

import { normalizeUrbitColor } from './utils';

describe('normalizeUrbitColor', () => {
  describe('the user submits a color hex value with one or more leading zeroes', () => {
    it('normalizes @ux values of color hexes for all zeroes', () => {
      expect(normalizeUrbitColor('0x0')).toEqual('#000000');
    });

    it('normalizes @ux values of color hexes with 5 leading zeros', () => {
      expect(normalizeUrbitColor('0xf')).toEqual('#00000F');
    });

    it('normalizes @ux values of color hexes with 4 leading zeros', () => {
      expect(normalizeUrbitColor('0xff')).toEqual('#0000FF');
    });

    it('normalizes @ux values of color hexes with 3 leading zeros', () => {
      expect(normalizeUrbitColor('0xfff')).toEqual('#000FFF');
    });

    it('normalizes @ux values of color hexes with 2 leading zeros', () => {
      expect(normalizeUrbitColor('0xffff')).toEqual('#00FFFF');
    });

    it('normalizes @ux values of color hexes with 1 leading zero', () => {
      expect(normalizeUrbitColor('0xf.ffff')).toEqual('#0FFFFF');
    });
  });

  it('normalizes colors with a leading alpha char', () => {
    expect(normalizeUrbitColor('0xff.ffff')).toEqual('#FFFFFF');
  });

  it('normalizes colors with a leading 0', () => {
    expect(normalizeUrbitColor('0x00.0000')).toEqual('#000000');
  });

  it('passes through color hexes', () => {
    expect(normalizeUrbitColor('#ffffff')).toEqual('#ffffff');
  });
});
