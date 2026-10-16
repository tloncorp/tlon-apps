import { describe, expect, test } from 'vitest';

import {
  STEWARD_BOTS_MIN_GROUPS_VERSION,
  deskVersionSupportsStewardBots,
} from './stewardBotsSupport';

describe('deskVersionSupportsStewardBots', () => {
  test('supports the minimum release and anything above it', () => {
    expect(
      deskVersionSupportsStewardBots(STEWARD_BOTS_MIN_GROUPS_VERSION)
    ).toBe(true);
    expect(deskVersionSupportsStewardBots('12.5.1')).toBe(true);
    expect(deskVersionSupportsStewardBots('13.0.0')).toBe(true);
  });

  test('refuses the releases below it', () => {
    expect(deskVersionSupportsStewardBots('12.4.1')).toBe(false);
    expect(deskVersionSupportsStewardBots('12.4.0')).toBe(false);
  });

  test('refuses a version it cannot fully parse rather than guessing', () => {
    expect(deskVersionSupportsStewardBots('12.5.0 dirty')).toBe(false);
    expect(deskVersionSupportsStewardBots('')).toBe(false);
    expect(deskVersionSupportsStewardBots(null)).toBe(false);
    expect(deskVersionSupportsStewardBots(undefined)).toBe(false);
  });
});
