import { describe, expect, it } from 'vitest';

import { IMAGE_REGEX, normalizeUrbitColor, whomIsFlag } from './utils';

describe('whomIsFlag', () => {
  it('passes valid flags', () => {
    const flags = [
      '~zod/t',
      '~zod/test',
      '~zod/test-test',
      '~zod/test-',
      '~zod/test1',
      '~marzod/t',
      '~marzod/test',
      '~marzod/test-test',
      '~marzod/test-',
      '~marzod/test1',
      '~wicdev-wisryt/t',
      '~wicdev-wisryt/test',
      '~wicdev-wisryt/test-test',
      '~wicdev-wisryt/test-',
      '~wicdev-wisryt/test1',
      '~mister-dister-dozzod-dozzod/t',
      '~mister-dister-dozzod-dozzod/test',
      '~mister-dister-dozzod-dozzod/test-test',
      '~mister-dister-dozzod-dozzod/test-',
      '~mister-dister-dozzod-dozzod/test1',
    ];

    flags.forEach((f) => expect(whomIsFlag(f)).toEqual(true));
  });

  it('fails invalid flags', () => {
    const flags = [
      '~',
      '~zod/',
      '~/',
      '~zod/1',
      '~zod/1test',
      '~zod/Test',
      '~zod/-',
      '~zod/-test',
      '~sample-planet/test', // invalid patp
    ];

    flags.forEach((f) => expect(whomIsFlag(f)).toEqual(false));
  });
});

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

describe('Image URL embed regex', () => {
  const validUrls = [
    'https://i.imgur.com/1234567.jpg',
    'https://i.imgur.com/1234567.png',
    'https://i.imgur.com/1234567.gif',
    'https://i.imgur.com/1234567.webp',
    'https://i.imgur.com/1234567.jpeg',
    'https://i.imgur.com/1234567.JPEG',
    'https://i.imgur.com/1234567.JPG',
    'https://i.imgur.com/1234567.jpg?test=123',
    'https://i.imgur.com/1234567.jpg?test=123&test2=456',
    'https://i.imgur.com/1234567.jpg?test=123&test2=456&test3=789',
  ];

  const invalidUrls = [
    'https://i.imgur.com/1234567',
    'https://i.imgur.com/1234567.',
    'https://i.imgur.com/1234567.pdf',
    'https://i.imgur.com/1234567.jpgg',
  ];

  it('passes valid image urls', () => {
    validUrls.forEach((url) => expect(url.match(IMAGE_REGEX)).toBeTruthy());
  });

  it('fails invalid image urls', () => {
    invalidUrls.forEach((url) => expect(url.match(IMAGE_REGEX)).toBeFalsy());
  });
});
