import { describe, expect, it } from 'vitest';

import type * as db from '../types/models';
import { generatePersonalGroupTitle } from './wayfinding';

describe.each([['generatePersonalGroupTitle', generatePersonalGroupTitle]])(
  '%s',
  (_name, generateTitle) => {
    it('builds the title from the nickname', () => {
      expect(generateTitle({ id: '~zod', nickname: 'Dan' })).toBe(
        "Dan's Group"
      );
    });

    it('trims surrounding whitespace so the possessive stays flush', () => {
      expect(generateTitle({ id: '~zod', nickname: 'Dan ' })).toBe(
        "Dan's Group"
      );
      expect(generateTitle({ id: '~zod', nickname: '  Dan  ' })).toBe(
        "Dan's Group"
      );
    });

    it('falls back to the id when the nickname is missing or blank', () => {
      expect(generateTitle({ id: '~zod' })).toBe("~zod's Group");
      expect(generateTitle({ id: '~zod', nickname: '   ' })).toBe(
        "~zod's Group"
      );
      expect(generateTitle({ id: '~zod', nickname: null })).toBe(
        "~zod's Group"
      );
    });
  }
);
