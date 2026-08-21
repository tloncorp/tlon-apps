import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONTEXT_LENS_RUN_TIMEOUT_MS,
  normalizeRunTimeoutMs,
} from './lifecycle-config.js';

describe('Tlon run lifecycle config', () => {
  it('defaults production runs to fifteen minutes', () => {
    expect(DEFAULT_CONTEXT_LENS_RUN_TIMEOUT_MS).toBe(900_000);
    expect(normalizeRunTimeoutMs(undefined)).toBe(900_000);
    expect(normalizeRunTimeoutMs(null)).toBe(900_000);
    expect(normalizeRunTimeoutMs(999)).toBe(900_000);
  });

  it('preserves an explicit valid timeout', () => {
    expect(normalizeRunTimeoutMs(180_000.9)).toBe(180_000);
  });
});
