import { describe, expect, test } from 'vitest';

import {
  STEWARD_PROMPTS_MIN_GROUPS_VERSION,
  deskVersionSupportsStewardPrompts,
} from './stewardPromptsSupport';

describe('deskVersionSupportsStewardPrompts', () => {
  test('supports the minimum release and anything above it', () => {
    expect(
      deskVersionSupportsStewardPrompts(STEWARD_PROMPTS_MIN_GROUPS_VERSION)
    ).toBe(true);
    expect(deskVersionSupportsStewardPrompts('12.4.0')).toBe(true);
    expect(deskVersionSupportsStewardPrompts('13.0.0')).toBe(true);
  });

  // these desks' %steward has no prompts module
  test('refuses the releases below it', () => {
    expect(deskVersionSupportsStewardPrompts('12.3.1')).toBe(false);
    expect(deskVersionSupportsStewardPrompts('12.2.0')).toBe(false);
  });

  test('refuses a version it cannot fully parse rather than guessing', () => {
    expect(deskVersionSupportsStewardPrompts('12.3.2 dirty')).toBe(false);
    expect(deskVersionSupportsStewardPrompts('')).toBe(false);
    expect(deskVersionSupportsStewardPrompts(null)).toBe(false);
    expect(deskVersionSupportsStewardPrompts(undefined)).toBe(false);
  });
});
