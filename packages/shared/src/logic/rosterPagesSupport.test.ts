import { describe, expect, test } from 'vitest';

import {
  ROSTER_PAGES_MIN_GROUPS_VERSION,
  deskVersionServesRosterPages,
} from './rosterPagesSupport';

describe('deskVersionServesRosterPages', () => {
  test('serves pages from the minimum release on', () => {
    expect(deskVersionServesRosterPages(ROSTER_PAGES_MIN_GROUPS_VERSION)).toBe(
      true
    );
    expect(deskVersionServesRosterPages('12.4.0')).toBe(true);
  });

  test('keeps the whole roster below it', () => {
    expect(deskVersionServesRosterPages('12.3.1')).toBe(false);
    expect(deskVersionServesRosterPages('12.2.0')).toBe(false);
  });

  test('keeps the whole roster for a version it cannot fully parse', () => {
    expect(deskVersionServesRosterPages('12.3.2 dirty')).toBe(false);
    expect(deskVersionServesRosterPages(null)).toBe(false);
    expect(deskVersionServesRosterPages(undefined)).toBe(false);
  });
});
