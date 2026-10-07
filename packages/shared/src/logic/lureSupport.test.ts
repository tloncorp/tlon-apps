import { describe, expect, test } from 'vitest';

import { deskVersionServesLureOnReel } from './lureSupport';

describe('deskVersionServesLureOnReel', () => {
  test('is on from the first %tlon desk release', () => {
    expect(deskVersionServesLureOnReel('13.0.0')).toBe(true);
    expect(deskVersionServesLureOnReel('13.1.2')).toBe(true);
  });

  test('is off for %groups desk releases', () => {
    expect(deskVersionServesLureOnReel('12.3.1')).toBe(false);
    expect(deskVersionServesLureOnReel('12.2.0')).toBe(false);
  });

  test('is unknown when the version cannot be read', () => {
    expect(deskVersionServesLureOnReel(undefined)).toBe(null);
    expect(deskVersionServesLureOnReel('n/a')).toBe(null);
    expect(deskVersionServesLureOnReel('13.0')).toBe(null);
  });
});
