import { describe, expect, test } from 'vitest';

import {
  displayIdStartsWith,
  displayIdToShip,
  shipToDisplayId,
  shipToFullDisplayId,
} from '../lib/urbit';

describe('shipToDisplayId', () => {
  test.each([
    ['~zod', '@aurora'],
    ['~marzod', '@bright.otter'],
    ['~sampel-palnet', '@brightly.tireless.butter.dhole'],
    ['sampel-palnet', '@brightly.tireless.butter.dhole'],
    // Moons show a short tag before their parent's name.
    ['~doznec-dozzod-dozzod', '@brave.badger · aurora'],
    ['~sampel-sampel-dozzod-bacwyd', '@curious.elk · worthy.panther'],
    // Comets show their short form, marked unverified.
    ['~doznec--dozzod-dozzod-dozzod-dozper', '@?anchor.anchor.anchor.compass'],
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

describe('shipToFullDisplayId', () => {
  test.each([
    '~sampel-palnet',
    '~doznec-dozzod-dozzod',
    '~doznec--dozzod-dozzod-dozzod-dozper',
  ])('names %s in a form search finds again', (ship) => {
    const name = shipToFullDisplayId(ship)!;
    expect(displayIdToShip(name)).toBe(ship);
  });

  test('is the display form for a planet', () => {
    expect(shipToFullDisplayId('sampel-palnet')).toBe(
      shipToDisplayId('~sampel-palnet')
    );
  });
});

describe('displayIdStartsWith', () => {
  test.each([
    'bri',
    '@bri',
    ' @Brightly.Tire',
    'brightly.tireless.butter.dhole',
  ])('matches %j', (text) => {
    expect(displayIdStartsWith('~sampel-palnet', text)).toBe(true);
  });

  test('matches a comet without its unverified mark', () => {
    expect(
      displayIdStartsWith('~doznec--dozzod-dozzod-dozzod-dozper', 'anchor')
    ).toBe(true);
  });

  test.each(['', '@', 'tireless', 'sam'])('does not match %j', (text) => {
    expect(displayIdStartsWith('~sampel-palnet', text)).toBe(false);
  });
});

describe('displayIdToShip', () => {
  test.each([
    ['@aurora', '~zod'],
    ['@brightly.tireless.butter.dhole', '~sampel-palnet'],
    ['brightly.tireless.butter.dhole', '~sampel-palnet'],
    [' @Brightly.Tireless.Butter.Dhole ', '~sampel-palnet'],
  ])('%j -> %s', (text, expected) => {
    expect(displayIdToShip(text)).toBe(expected);
  });

  test.each([
    '',
    '@',
    '~zod',
    '1.624.961.343',
    '@brightly.tireless',
    // Lossy display forms name no single ship.
    '@brave.badger · aurora',
    '@?anchor.anchor.anchor.compass',
  ])('returns null for %j', (text) => {
    expect(displayIdToShip(text)).toBeNull();
  });
});
