import { describe, expect, it } from 'vitest';

import type * as db from '../types/models';
import {
  botHomeGroupHasDefaultTitle,
  generateBotHomeGroupTitle,
  generatePersonalGroupTitle,
} from './wayfinding';

const groupWithTitle = (title: string) =>
  ({ title, hostUserId: '~zod' }) as db.Group;

describe('botHomeGroupHasDefaultTitle', () => {
  it.each(['Group', 'Home', 'Home Group', 'My agent group', "~zod's Group"])(
    'recognizes the exact default title %s',
    (title) => {
      expect(botHomeGroupHasDefaultTitle(groupWithTitle(title))).toBe(true);
    }
  );

  it.each([
    'Home Automation',
    'Research Group',
    "Dan's Tlonbot",
    "Dan's Research Bot",
  ])('preserves the customized title %s', (title) => {
    expect(botHomeGroupHasDefaultTitle(groupWithTitle(title))).toBe(false);
  });

  it('recognizes the exact title generated from the previous nickname', () => {
    for (const title of ["Alice's Group", "Alice's Tlonbot"]) {
      expect(botHomeGroupHasDefaultTitle(groupWithTitle(title), 'Alice')).toBe(
        true
      );
      expect(botHomeGroupHasDefaultTitle(groupWithTitle(title), 'Bob')).toBe(
        false
      );
    }
  });
});

describe.each([
  ['generatePersonalGroupTitle', generatePersonalGroupTitle],
  ['generateBotHomeGroupTitle', generateBotHomeGroupTitle],
])('%s', (_name, generateTitle) => {
  it('builds the title from the nickname', () => {
    expect(generateTitle({ id: '~zod', nickname: 'Dan' })).toBe("Dan's Group");
  });

  it('trims surrounding whitespace so the possessive stays flush', () => {
    expect(generateTitle({ id: '~zod', nickname: 'Dan ' })).toBe("Dan's Group");
    expect(generateTitle({ id: '~zod', nickname: '  Dan  ' })).toBe(
      "Dan's Group"
    );
  });

  it('falls back to the id when the nickname is missing or blank', () => {
    expect(generateTitle({ id: '~zod' })).toBe("~zod's Group");
    expect(generateTitle({ id: '~zod', nickname: '   ' })).toBe("~zod's Group");
    expect(generateTitle({ id: '~zod', nickname: null })).toBe("~zod's Group");
  });
});
