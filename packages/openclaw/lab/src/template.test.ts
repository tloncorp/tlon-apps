import { expect, test } from 'vitest';
import { cronNow, referenceUtc, skillVersion, stamp } from './template.js';

// Formats copied from a captured OpenClaw 2026.7.1 request.
test('writes times the way OpenClaw does', () => {
  const at = new Date('2026-09-26T19:14:00Z');
  expect(stamp(new Date('2026-09-26T18:57:00Z'), 'UTC')).toBe(
    'Sat 2026-09-26 18:57 UTC'
  );
  expect(cronNow(at, 'UTC')).toBe(
    'Saturday, September 26th, 2026 - 7:14 PM (UTC)'
  );
  expect(referenceUtc(at)).toBe('2026-09-26 19:14 UTC');
  expect(cronNow(new Date('2026-10-01T08:05:00Z'), 'UTC')).toBe(
    'Thursday, October 1st, 2026 - 8:05 AM (UTC)'
  );
  expect(cronNow(new Date('2026-10-12T08:05:00Z'), 'UTC')).toContain('12th');
});

test('versions skills like OpenClaw', () => {
  expect(skillVersion('abc')).toBe('ba7816bf8f01cfea');
});
