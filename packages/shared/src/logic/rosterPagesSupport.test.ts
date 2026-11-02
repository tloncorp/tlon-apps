import { describe, expect, test } from 'vitest';

import { isRosterWhole } from './rosterPagesSupport';

describe('isRosterWhole', () => {
  test('only once a whole sync landed in this session', () => {
    expect(isRosterWhole(200, 100)).toBe(true);
    expect(isRosterWhole(50, 100)).toBe(false);
    expect(isRosterWhole(null, 100)).toBe(false);
    expect(isRosterWhole(200, undefined)).toBe(false);
  });
});
