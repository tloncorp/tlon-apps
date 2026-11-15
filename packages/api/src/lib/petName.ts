// Pet names: a reversible word rendering of a ship (~sampel-palnet ->
// @brightly.tireless.butter.dhole). The leading @ marks the name as an
// address, the way ~ marks an @p. The word lists are frozen: every index is
// part of someone's name, so they are never edited, reordered or translated.
//
// A pet name is a re-skin of the @p: it encodes the same bytes the @p
// syllables do, i.e. the value after aura's `fein` scramble. aura doesn't
// export `fein`/`fynd`, but `@q` uses the same syllables without the
// scramble, so reading a ship's @p syllables as `@q` yields the scrambled
// value, and parsing rebuilt syllables as `@p` unscrambles it.
//
// Word count encodes the class, so names of different classes can't collide:
//   galaxy  8 bits    @galaxy                         (256)
//   star    16 bits   @adjective.animal               (256 x 256)
//   planet  32 bits   @adverb.adjective.color.animal  (256 x 512 x 64 x 512)
//   moon    64 bits   @<planet-shaped high 32 bits> · <parent's name>
//   comet   128 bits  16 comet words in groups of 4; display form is the
//                     last 4, marked unverified
// A star's low byte is its galaxy, as in @p (~marzod under ~zod), so every
// star under a galaxy shares its animal word.
import { p, render, tryParse } from '@urbit/aura';

import words from './petNameWords.json';

export const PET_NAME_WORDS_VERSION = words.version;

export const PET_NAME_SIGIL = '@';
const WORD_SEPARATOR = '.';
const COMET_GROUP_SEPARATOR = '-';
export const MOON_SEPARATOR = ' · ';
export const COMET_UNVERIFIED_MARKER = '?';

export type PetNameOptions = {
  // 'full' is reversible. 'tag' names the moon by 16 of its 32 bits; it is
  // lossy, which is tolerable because only the parent's owner can make moons.
  moon?: 'full' | 'tag';
  // 'full' is reversible. 'short' is the last 4 of the 16 words; it can be
  // matched by grinding ~2^32 keys, so it must always carry the marker.
  comet?: 'full' | 'short';
};

const index = (list: string[]) => new Map(list.map((w, i) => [w, i]));
const lookup = {
  galaxies: index(words.galaxies),
  adverbs: index(words.adverbs),
  adjectives: index(words.adjectives),
  colors: index(words.colors),
  animals: index(words.animals),
  comets: index(words.comets),
};

// Star words come from the first 256 of the planet adjective and animal lists.
function starWords(x: number): string[] {
  return [words.adjectives[x >> 8], words.animals[x & 0xff]];
}

function planetWords(x: number): string[] {
  const animal = x % 512;
  const color = Math.floor(x / 512) % 64;
  const adjective = Math.floor(x / 32768) % 512;
  const adverb = Math.floor(x / 16777216);
  return [
    words.adverbs[adverb],
    words.adjectives[adjective],
    words.colors[color],
    words.animals[animal],
  ];
}

// Name for a scrambled value of at most 32 bits; class follows from its size,
// since `fein` keeps each class within its own range.
function nameUpTo32(x: number): string {
  if (x < 0x100) {
    return words.galaxies[x];
  }
  return (x < 0x10000 ? starWords(x) : planetWords(x)).join(WORD_SEPARATOR);
}

function parseShip(patp: string): { n: bigint; x: bigint } | null {
  const n = tryParse('p', patp);
  if (n === null) {
    return null;
  }
  const syllables = patp.slice(1).split(/-+/).join('-');
  return { n, x: tryParse('q', `.~${syllables}`)! };
}

// `ship` is a canonical @p, with its ~.
export function shipToPetName(
  ship: string,
  options: PetNameOptions = {}
): string | null {
  const parsed = ship ? parseShip(ship) : null;
  if (parsed === null) {
    return null;
  }
  const { n, x } = parsed;
  switch (p.kind(n)) {
    case 'galaxy':
    case 'star':
    case 'planet':
      return PET_NAME_SIGIL + nameUpTo32(Number(x));
    case 'moon': {
      const high = Number(x >> 32n);
      const parent = nameUpTo32(Number(x & 0xffffffffn));
      const moonPart =
        options.moon === 'tag' ? starWords(high & 0xffff) : planetWords(high);
      return (
        PET_NAME_SIGIL + moonPart.join(WORD_SEPARATOR) + MOON_SEPARATOR + parent
      );
    }
    case 'comet': {
      const comet = cometWords(x);
      return options.comet === 'short'
        ? PET_NAME_SIGIL +
            COMET_UNVERIFIED_MARKER +
            comet.slice(12).join(WORD_SEPARATOR)
        : PET_NAME_SIGIL +
            [0, 4, 8, 12]
              .map((i) => comet.slice(i, i + 4).join(WORD_SEPARATOR))
              .join(COMET_GROUP_SEPARATOR);
    }
  }
}

function cometWords(x: bigint): string[] {
  return Array.from(
    { length: 16 },
    (_, i) => words.comets[Number((x >> BigInt(8 * (15 - i))) & 0xffn)]
  );
}

// Rebuild the @p for a scrambled value: its @q syllables, zero-padded to
// whole 16-bit words and grouped like @p, parsed as @p (which applies `fynd`).
function unscrambledPatp(x: bigint): string | null {
  const q = render('q', x).slice(2).split('-');
  if (x >= 0x100n && q[0].length === 3) {
    q[0] = 'doz' + q[0];
  }
  const patp =
    '~' +
    q
      .reverse()
      .reduce((acc, word, t) =>
        t === 0 ? word : word + (t % 4 === 0 ? '--' : '-') + acc
      );
  return tryParse('p', patp) === null ? null : patp;
}

function wordIndex(list: keyof typeof lookup, word: string): number {
  const i = lookup[list].get(word);
  if (i === undefined) {
    throw new RangeError(word);
  }
  return i;
}

function parseUpTo32(name: string): number {
  const w = name.split(WORD_SEPARATOR);
  switch (w.length) {
    case 1:
      return wordIndex('galaxies', w[0]);
    case 2:
      return wordIndex('adjectives', w[0]) * 256 + wordIndex('animals', w[1]);
    case 4:
      return parsePlanetShape(w);
    default:
      throw new RangeError(name);
  }
}

function parsePlanetShape(w: string[]): number {
  if (w.length !== 4) {
    throw new RangeError(w.join(WORD_SEPARATOR));
  }
  return (
    wordIndex('adverbs', w[0]) * 16777216 +
    wordIndex('adjectives', w[1]) * 32768 +
    wordIndex('colors', w[2]) * 512 +
    wordIndex('animals', w[3])
  );
}

function parseScrambled(name: string): bigint {
  if (!name.startsWith(PET_NAME_SIGIL)) {
    throw new RangeError(name);
  }
  const body = name.slice(PET_NAME_SIGIL.length);
  const [moonPart, parent, ...rest] = body.split(MOON_SEPARATOR);
  if (rest.length > 0) {
    throw new RangeError(name);
  }
  if (parent !== undefined) {
    const high = BigInt(parsePlanetShape(moonPart.split(WORD_SEPARATOR)));
    return (high << 32n) | BigInt(parseUpTo32(parent));
  }
  if (body.includes(COMET_GROUP_SEPARATOR)) {
    return body
      .split(/[.-]/)
      .reduce((acc, w) => (acc << 8n) | BigInt(wordIndex('comets', w)), 0n);
  }
  return BigInt(parseUpTo32(body));
}

// Inverse of shipToPetName's reversible forms. Lossy forms (moon tags, short
// comets) and non-canonical spellings return null.
export function petNameToShip(name: string): string | null {
  const trimmed = name.trim();
  try {
    const patp = unscrambledPatp(parseScrambled(trimmed));
    return patp !== null && shipToPetName(patp) === trimmed ? patp : null;
  } catch (e) {
    if (e instanceof RangeError) {
      return null;
    }
    throw e;
  }
}
