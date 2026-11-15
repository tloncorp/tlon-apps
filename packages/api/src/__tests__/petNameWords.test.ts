// Validator for the pet-name word lists. Every rule here holds for the whole
// list, so lists can be iterated on while the test stays green.
import { describe, expect, test } from 'vitest';

import words from '../lib/petNameWords.json';

const LISTS = {
  galaxies: { size: 256, maxLength: 8 },
  adverbs: { size: 256, maxLength: 8 },
  adjectives: { size: 512, maxLength: 8 },
  colors: { size: 64, maxLength: 8 },
  animals: { size: 512, maxLength: 9 },
  comets: { size: 256, maxLength: 8 },
} as const;
type ListName = keyof typeof LISTS;

// Words with a US/UK spelling pair. Users would type the other spelling, so
// neither may appear.
const SPELLING_VARIANTS = `gray grey ochre ocher color colour colorful
colourful cozy cosy savory savoury harbor harbour vapor vapour mollusk mollusc
plow plough skillfully skilfully jewelry jewellery mold mould honor honour
favor favour armor armour doberman dobermann tire tyre aluminum aluminium`;

const HOMOPHONES: [string, string][] = [
  ['deer', 'dear'],
  ['hare', 'hair'],
  ['whale', 'wail'],
  ['bear', 'bare'],
  ['flea', 'flee'],
  ['gnu', 'new'],
  ['roe', 'row'],
  ['sun', 'son'],
  ['pail', 'pale'],
  ['plain', 'plane'],
  ['peak', 'peek'],
  ['sea', 'see'],
  ['vale', 'veil'],
  ['isle', 'aisle'],
  ['sole', 'soul'],
  ['tide', 'tied'],
  ['rose', 'rows'],
  ['mussel', 'muscle'],
  ['fir', 'fur'],
  ['moose', 'mousse'],
  ['lynx', 'links'],
  ['mist', 'missed'],
  ['knight', 'night'],
  ['rain', 'reign'],
  ['rein', 'rain'],
  ['hart', 'heart'],
  ['tern', 'turn'],
  ['ewe', 'yew'],
  ['bow', 'bough'],
  ['main', 'mane'],
  ['sale', 'sail'],
  ['loot', 'lute'],
  ['knot', 'not'],
  ['dew', 'due'],
  ['doe', 'dough'],
  ['yolk', 'yoke'],
  ['ore', 'oar'],
  ['awl', 'owl'],
  ['coral', 'choral'],
  ['pole', 'poll'],
  ['lyre', 'liar'],
  ['boulder', 'bolder'],
  ['duel', 'dual'],
  ['hoarse', 'horse'],
  ['flour', 'flower'],
  ['steak', 'stake'],
  ['towed', 'toad'],
  ['quartz', 'quarts'],
];

// Words that read as insults, slurs or innuendo when they name a person.
// Primates are excluded because ape names are a racist slur vector.
const DENIED = `pig hog cow rat roach weasel snake slug leech louse maggot skunk
ass donkey mule shrew vulture worm cock cockatoo cockle tit titmouse booby shag
beaver cougar vixen bitch dodo turkey chicken heifer nymph tomcat crab weevil
polecat lamprey viper piglet hyena jackal toad bat sponge monkey ape gorilla
chimp baboon bonobo gibbon orangutan mandrill macaque langur colobus vervet
uakari saki tamarin marmoset gelada lazy fat dirty dumb slow ugly old silly hot
sexy naughty frisky easy loose cunning huge jumbo colossal immense giant ample
roomy slender svelte rowdy basic fruity salty spicy juicy creamy dusky exotic
rarely barely hardly nearly almost meekly tamely comically dagger sword spear
razor screw knob jug urn tool tank star moon comet galaxy planet`;

// Adjacent-word combinations that read as insults. Checked against the slots
// that are adjacent in some shape: adjective-animal (stars, planets, moon
// tags) and color-animal (planets).
const DENIED_COMBOS: [string, string][] = [
  ['dirty', 'rat'],
  ['fat', 'pig'],
  ['lazy', 'dog'],
  ['dumb', 'ox'],
  ['old', 'bat'],
  ['old', 'cow'],
  ['dirty', 'dog'],
  ['lame', 'duck'],
  ['cold', 'fish'],
  ['sly', 'fox'],
  ['silly', 'goose'],
  ['busy', 'beaver'],
  ['yellow', 'chicken'],
  ['black', 'monkey'],
  ['brown', 'noser'],
  ['cheeky', 'monkey'],
  ['dirty', 'hound'],
  ['mangy', 'dog'],
  ['dumb', 'bunny'],
];

const lists = Object.keys(LISTS) as ListName[];
const all = lists.flatMap((name) => words[name].map((w) => ({ name, w })));
const listsOf = (w: string) => all.filter((e) => e.w === w).map((e) => e.name);

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return row[b.length];
}

describe('pet-name word lists', () => {
  test('carry a version', () => {
    expect(Number.isInteger(words.version)).toBe(true);
  });

  describe.each(lists)('%s', (name) => {
    const list: string[] = words[name];
    const { size, maxLength } = LISTS[name];

    test(`has exactly ${size} words`, () => {
      expect(list).toHaveLength(size);
    });

    test(`words are lowercase ASCII, 3-${maxLength} letters`, () => {
      const bad = list.filter(
        (w) => !/^[a-z]+$/.test(w) || w.length < 3 || w.length > maxLength
      );
      expect(bad).toEqual([]);
    });

    test('first four letters are unique', () => {
      const seen = new Map<string, string>();
      const clashes: string[] = [];
      for (const w of list) {
        const prefix = w.slice(0, 4);
        if (seen.has(prefix)) {
          clashes.push(`${seen.get(prefix)}/${w}`);
        }
        seen.set(prefix, w);
      }
      expect(clashes).toEqual([]);
    });

    test('no two words within edit distance 1', () => {
      const close: string[] = [];
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          if (Math.abs(a.length - b.length) <= 1 && editDistance(a, b) <= 1) {
            close.push(`${a}/${b}`);
          }
        }
      }
      expect(close).toEqual([]);
    });
  });

  test('no word appears in two lists', () => {
    const shared = [...new Set(all.map((e) => e.w))].filter(
      (w) => listsOf(w).length > 1
    );
    expect(shared).toEqual([]);
  });

  test('no homophone pairs', () => {
    const present = new Set(all.map((e) => e.w));
    expect(
      HOMOPHONES.filter(([a, b]) => present.has(a) && present.has(b))
    ).toEqual([]);
  });

  test('no words with a US/UK spelling variant', () => {
    const present = new Set(all.map((e) => e.w));
    expect(
      SPELLING_VARIANTS.split(/\s+/).filter((w) => present.has(w))
    ).toEqual([]);
  });

  test('no denied words', () => {
    const present = new Set(all.map((e) => e.w));
    expect(DENIED.split(/\s+/).filter((w) => present.has(w))).toEqual([]);
  });

  test('no denied adjacent combinations', () => {
    const modifiers = new Set([...words.adjectives, ...words.colors]);
    const animals = new Set(words.animals);
    expect(
      DENIED_COMBOS.filter(([a, b]) => modifiers.has(a) && animals.has(b))
    ).toEqual([]);
  });
});
