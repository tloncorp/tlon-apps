import { describe, expect, test } from 'vitest';

import {
  BUCKETS_MIN_GROUPS_VERSION,
  deskVersionSupportsBuckets,
} from './bucketsSupport';

describe('deskVersionSupportsBuckets', () => {
  test('supports the minimum release and anything above it', () => {
    expect(deskVersionSupportsBuckets(BUCKETS_MIN_GROUPS_VERSION)).toBe(true);
    expect(deskVersionSupportsBuckets('12.3.1')).toBe(true);
    expect(deskVersionSupportsBuckets('13.0.0')).toBe(true);
  });

  // 12.2.x passes the desk gate but has no %buckets agent, and still sees
  // Buckets listed in groups hosted on 12.3.
  test('rejects the supported band below it', () => {
    expect(deskVersionSupportsBuckets('12.2.0')).toBe(false);
    expect(deskVersionSupportsBuckets('12.2.9')).toBe(false);
    expect(deskVersionSupportsBuckets('11.4.0')).toBe(false);
  });

  test('rejects a version it cannot fully parse rather than guessing', () => {
    expect(deskVersionSupportsBuckets('12.3.0 dirty')).toBe(false);
    expect(deskVersionSupportsBuckets('12.3')).toBe(false);
    expect(deskVersionSupportsBuckets('')).toBe(false);
    expect(deskVersionSupportsBuckets(null)).toBe(false);
    expect(deskVersionSupportsBuckets(undefined)).toBe(false);
  });
});
