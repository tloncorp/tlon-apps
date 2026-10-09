import { describe, expect, test } from 'vitest';

import { deskVersionSupportsAutomations } from './automationsSupport';

describe('deskVersionSupportsAutomations', () => {
  test('supports the release that added delivery and anything above it', () => {
    expect(deskVersionSupportsAutomations('12.3.1')).toBe(true);
    expect(deskVersionSupportsAutomations('12.4.0')).toBe(true);
    expect(deskVersionSupportsAutomations('13.0.0')).toBe(true);
  });

  // 12.3.0 has the mirror and the edit loop, but drops a task's destination.
  test('rejects the release that has the routes without delivery, and older', () => {
    expect(deskVersionSupportsAutomations('12.3.0')).toBe(false);
    expect(deskVersionSupportsAutomations('12.2.0')).toBe(false);
  });

  test('rejects a version it cannot fully parse rather than guessing', () => {
    expect(deskVersionSupportsAutomations('12.3.1 dirty')).toBe(false);
    expect(deskVersionSupportsAutomations('12.3')).toBe(false);
    expect(deskVersionSupportsAutomations(null)).toBe(false);
    expect(deskVersionSupportsAutomations(undefined)).toBe(false);
  });
});
