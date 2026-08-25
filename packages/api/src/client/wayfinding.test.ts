import { describe, expect, it } from 'vitest';

import type * as db from '../types/models';
import { botHomeGroupHasDefaultTitle } from './wayfinding';

const groupWithTitle = (title: string) =>
  ({ title, hostUserId: '~zod' }) as db.Group;

describe('botHomeGroupHasDefaultTitle', () => {
  it.each(['Group', 'Home', 'Home Group', 'My agent group', "~zod's Group"])(
    'recognizes the exact default title %s',
    (title) => {
      expect(botHomeGroupHasDefaultTitle(groupWithTitle(title))).toBe(true);
    }
  );

  it.each(['Home Automation', 'Research Group', "Dan's Tlonbot"])(
    'preserves the customized title %s',
    (title) => {
      expect(botHomeGroupHasDefaultTitle(groupWithTitle(title))).toBe(false);
    }
  );

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
