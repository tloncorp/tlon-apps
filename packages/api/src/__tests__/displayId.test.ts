import { describe, expect, test } from 'vitest';

import { displayIdToShip, shipToDisplayId } from '../lib/urbit';

describe('shipToDisplayId', () => {
  test.each([
    ['~zod', '0'],
    ['~ten', '160'],
    ['~marzod', '256'],
    ['~sampel', '1.135'],
    ['~sampel-palnet', '1.624.961.343'],
    ['sampel-palnet', '1.624.961.343'],
    ['~doznec-dozzod-dozzod', '4.294.967.296'],
    ['~doznec--dozzod-dozzod-dozzod-dozper', '18.446.744.073.709.551.621'],
    [
      '~fipfes-fipfes-fipfes-fipfes--fipfes-fipfes-fipfes-fipfes',
      '340.282.366.920.938.463.463.374.607.431.768.211.455',
    ],
  ])('%s -> %s', (ship, expected) => {
    expect(shipToDisplayId(ship)).toBe(expected);
  });

  test.each([
    '',
    '~',
    '~foo',
    'not a ship',
    '~sampel-palnet/group',
    // non-canonical: leading zero words are dropped when rendering
    '~dozzod-dozzod-dozzod-dozzod-dozzod-dozzod-dozzod-dozzod',
  ])('returns null for %j', (input) => {
    expect(shipToDisplayId(input)).toBeNull();
  });
});

describe('displayIdToShip', () => {
  test.each([
    ['0', '~zod'],
    ['1.624.961.343', '~sampel-palnet'],
    ['1624961343', '~sampel-palnet'],
    [' 1.624.961.343 ', '~sampel-palnet'],
    ['4.294.967.296', '~doznec-dozzod-dozzod'],
  ])('%s -> %s', (text, expected) => {
    expect(displayIdToShip(text)).toBe(expected);
  });

  test.each([
    '',
    '~zod',
    'abc',
    '1.62',
    '1,624',
    '340282366920938463463374607431768211456',
  ])('returns null for %j', (text) => {
    expect(displayIdToShip(text)).toBeNull();
  });
});
