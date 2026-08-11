import { describe, expect, test } from 'vitest';

import {
  NOTES_SEARCH_MIN_GROUPS_VERSION,
  groupsVersionSupportsNotesSearch,
} from './notesSearchSupport';

describe('groupsVersionSupportsNotesSearch', () => {
  test('supports the minimum release and anything above it', () => {
    expect(
      groupsVersionSupportsNotesSearch(NOTES_SEARCH_MIN_GROUPS_VERSION)
    ).toBe(true);
    expect(groupsVersionSupportsNotesSearch('12.1.1')).toBe(true);
    expect(groupsVersionSupportsNotesSearch('12.2.0')).toBe(true);
    expect(groupsVersionSupportsNotesSearch('13.0.0')).toBe(true);
  });

  test('rejects releases without the search endpoint', () => {
    expect(groupsVersionSupportsNotesSearch('12.0.1')).toBe(false);
    expect(groupsVersionSupportsNotesSearch('12.0.0')).toBe(false);
    expect(groupsVersionSupportsNotesSearch('11.4.0')).toBe(false);
  });

  test('rejects a version it cannot fully parse rather than guessing', () => {
    // '12.1.0 dirty' would pass a prefix check, then compare as equal to the
    // minimum inside isVersionBelow — so it has to be rejected outright.
    expect(groupsVersionSupportsNotesSearch('12.1.0 dirty')).toBe(false);
    expect(groupsVersionSupportsNotesSearch('n/a')).toBe(false);
    expect(groupsVersionSupportsNotesSearch('12.1')).toBe(false);
    expect(groupsVersionSupportsNotesSearch('')).toBe(false);
    expect(groupsVersionSupportsNotesSearch(null)).toBe(false);
    expect(groupsVersionSupportsNotesSearch(undefined)).toBe(false);
  });
});
