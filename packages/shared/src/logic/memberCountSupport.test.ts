import { describe, expect, test } from 'vitest';

import {
  FULL_MEMBER_COUNT_MIN_GROUPS_VERSION,
  deskVersionCountsAllSeats,
} from './memberCountSupport';

describe('deskVersionCountsAllSeats', () => {
  test('trusts the minimum release and anything above it', () => {
    expect(
      deskVersionCountsAllSeats(FULL_MEMBER_COUNT_MIN_GROUPS_VERSION)
    ).toBe(true);
    expect(deskVersionCountsAllSeats('12.4.1')).toBe(true);
    expect(deskVersionCountsAllSeats('13.0.0')).toBe(true);
  });

  // these desks count only the 15 seats their init and changes keep
  test('distrusts the releases below it', () => {
    expect(deskVersionCountsAllSeats('12.3.1')).toBe(false);
    expect(deskVersionCountsAllSeats('12.2.0')).toBe(false);
  });

  test('distrusts a version it cannot fully parse rather than guessing', () => {
    expect(deskVersionCountsAllSeats('12.4.0 dirty')).toBe(false);
    expect(deskVersionCountsAllSeats('')).toBe(false);
    expect(deskVersionCountsAllSeats(null)).toBe(false);
    expect(deskVersionCountsAllSeats(undefined)).toBe(false);
  });
});
