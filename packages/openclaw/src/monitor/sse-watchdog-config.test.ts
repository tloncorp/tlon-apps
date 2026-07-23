import { describe, expect, it } from 'vitest';

import { parseSseWatchdogIntervalMs } from './sse-watchdog-config.js';

describe('parseSseWatchdogIntervalMs', () => {
  it.each(['1', '30000', '2147483647'])('accepts %s', (raw) => {
    expect(parseSseWatchdogIntervalMs(raw)).toBe(Number(raw));
  });

  it.each([
    ['undefined', undefined],
    ['empty string', ''],
    ['zero', '0'],
    ['negative', '-5'],
    ['fractional', '1.5'],
    ['NaN', 'NaN'],
    ['Infinity', 'Infinity'],
    ['unsafe integer', '9007199254740993'],
    ['above max timer delay', '2147483648'],
  ])('rejects %s', (_label, raw) => {
    expect(parseSseWatchdogIntervalMs(raw)).toBeUndefined();
  });
});
