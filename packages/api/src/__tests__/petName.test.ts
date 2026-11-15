import { render, tryParse } from '@urbit/aura';
import { describe, expect, test } from 'vitest';

import {
  COMET_UNVERIFIED_MARKER,
  MOON_SEPARATOR,
  petNameToShip,
  shipToPetName,
} from '../lib/petName';
import words from '../lib/petNameWords.json';

// Deterministic PRNG so failures reproduce.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}
const rand32 = mulberry32(0x7e7);
const randBits = (bits: number) => {
  let n = 0n;
  for (let i = 0; i < bits; i += 32) {
    n = (n << 32n) | BigInt(rand32());
  }
  return n & ((1n << BigInt(bits)) - 1n);
};

const shipOf = (n: bigint) => render('p', n);

function expectRoundTrip(ships: bigint[]) {
  const names = new Set<string>();
  for (const n of ships) {
    const ship = shipOf(n);
    const name = shipToPetName(ship)!;
    expect(petNameToShip(name)).toBe(ship);
    names.add(name);
  }
  expect(names.size).toBe(new Set(ships).size);
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => BigInt(from + i));

describe('shipToPetName / petNameToShip', () => {
  test('known ships', () => {
    expect(shipToPetName('~zod')).toBe('aurora');
    expect(shipToPetName('~marzod')).toBe('bright-otter');
    expect(shipToPetName('~sampel-palnet')).toBe(
      'brightly-tireless-butter-dhole'
    );
    expect(shipToPetName('sampel-palnet')).toBe(
      'brightly-tireless-butter-dhole'
    );
    expect(shipToPetName('~doznec-dozzod-sampel-palnet')).toBe(
      'gently-calm-red-otter · brightly-tireless-butter-dhole'
    );
    expect(shipToPetName('~doznec-dozzod-sampel-palnet', { moon: 'tag' })).toBe(
      'brave-otter · brightly-tireless-butter-dhole'
    );
    expect(petNameToShip('brightly-tireless-butter-dhole')).toBe(
      '~sampel-palnet'
    );
  });

  test('encodes the bytes the @p syllables encode', () => {
    // ~sampel-palnet is 0x60daf13f; its syllables spell fein(n) = 0x046f7f4f.
    const x = tryParse('q', '.~sampel-palnet')!;
    expect(x).toBe(0x046f7f4fn);
    const [adverb, adjective, color, animal] =
      shipToPetName('~sampel-palnet')!.split('-');
    expect(
      words.adverbs.indexOf(adverb) * 2 ** 24 +
        words.adjectives.indexOf(adjective) * 2 ** 15 +
        words.colors.indexOf(color) * 2 ** 9 +
        words.animals.indexOf(animal)
    ).toBe(Number(x));
  });

  test('every galaxy round-trips to a distinct one-word name', () => {
    const galaxies = range(0, 0x100);
    expectRoundTrip(galaxies);
    for (const n of galaxies) {
      expect(shipToPetName(shipOf(n))).toBe(words.galaxies[Number(n)]);
    }
  });

  test('every star round-trips to a distinct two-word name', () => {
    expectRoundTrip(range(0x100, 0x10000));
  });

  test("a star's animal is its galaxy's byte, like the @p suffix", () => {
    const animal = (ship: string) => shipToPetName(ship)!.split('-')[1];
    expect(animal('~marzod')).toBe(animal('~binzod'));
    expect(animal('~marzod')).not.toBe(animal('~marnec'));
  });

  test('planet names are a mixed-radix bijection on 32 bits', () => {
    // 256 * 512 * 64 * 512 = 2^32: each slot is a digit, so distinct values
    // give distinct names and every name decodes to one value.
    expect(
      words.adverbs.length *
        words.adjectives.length *
        words.colors.length *
        words.animals.length
    ).toBe(2 ** 32);
    const sample = [0x10000n, 0x10001n, 0xffffffffn, 0xfffffffen];
    for (let i = 0; i < 20000; i++) {
      sample.push(0x10000n + (randBits(32) % (2n ** 32n - 0x10000n)));
    }
    expectRoundTrip(sample);
    for (const n of sample) {
      expect(shipToPetName(shipOf(n))!.split('-')).toHaveLength(4);
    }
  });

  test('sequential planets under one star get unrelated names', () => {
    const star = 0x0100n; // ~marzod
    const names = [1n, 2n, 3n].map((i) =>
      shipToPetName(shipOf((i << 16n) | star))!.split('-')
    );
    for (let slot = 0; slot < 4; slot++) {
      expect(new Set(names.map((w) => w[slot])).size).toBeGreaterThan(1);
    }
  });

  test('moons round-trip, including moons of galaxies and stars', () => {
    const sample: bigint[] = [];
    for (let i = 0; i < 5000; i++) {
      const high = 1n + (randBits(32) % (2n ** 32n - 1n));
      sample.push((high << 32n) | randBits(32));
    }
    sample.push((1n << 32n) | 0n, (1n << 32n) | 0x100n, 2n ** 64n - 1n);
    expectRoundTrip(sample);
  });

  test('moon tags are lossy and do not parse', () => {
    const moon = shipOf((7n << 32n) | 0x60daf13fn);
    const tag = shipToPetName(moon, { moon: 'tag' })!;
    expect(tag.split(MOON_SEPARATOR)[0].split('-')).toHaveLength(2);
    expect(petNameToShip(tag)).toBeNull();
  });

  test('comets round-trip in full form', () => {
    const sample = [2n ** 64n, 2n ** 128n - 1n];
    for (let i = 0; i < 2000; i++) {
      sample.push(2n ** 64n + (randBits(128) % (2n ** 128n - 2n ** 64n)));
    }
    expectRoundTrip(sample);
    expect(shipToPetName(shipOf(2n ** 128n - 1n))!.split(/--?/)).toHaveLength(
      16
    );
  });

  test('short comets are marked, are the full form’s tail, and do not parse', () => {
    const comet = shipOf(2n ** 100n + 12345n);
    const short = shipToPetName(comet, { comet: 'short' })!;
    const full = shipToPetName(comet)!;
    expect(short.startsWith(COMET_UNVERIFIED_MARKER)).toBe(true);
    expect(full.endsWith(short.slice(COMET_UNVERIFIED_MARKER.length))).toBe(
      true
    );
    expect(petNameToShip(short)).toBeNull();
    expect(petNameToShip(short.slice(1))).toBeNull();
  });

  test('rejects invalid and non-canonical input', () => {
    for (const bad of [
      '',
      'nope',
      'Aurora',
      'bright--otter',
      'otter-bright',
      'brightly-tireless-butter',
      // A planet-shaped name for a value below the planet range.
      `${words.adverbs[0]}-${words.adjectives[0]}-${words.colors[0]}-${words.animals[0]}`,
      // A moon whose moon part is zero is its parent planet.
      `${words.adverbs[0]}-${words.adjectives[0]}-${words.colors[0]}-${words.animals[0]}${MOON_SEPARATOR}aurora`,
    ]) {
      expect(petNameToShip(bad)).toBeNull();
    }
    expect(shipToPetName('')).toBeNull();
    expect(shipToPetName('~notaship')).toBeNull();
  });
});
