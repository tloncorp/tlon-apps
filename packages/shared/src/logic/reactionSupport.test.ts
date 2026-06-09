import { describe, expect, test } from 'vitest';

import { backendVersionSupportsReactions } from './reactionSupport';

describe('backendVersionSupportsReactions', () => {
  test('false below the minimum (incl. current deployed version)', () => {
    expect(backendVersionSupportsReactions('11.2.2')).toBe(false);
    expect(backendVersionSupportsReactions('11.0.1')).toBe(false);
    expect(backendVersionSupportsReactions('10.9.9')).toBe(false);
  });

  test('true at or above the minimum', () => {
    expect(backendVersionSupportsReactions('11.3.0')).toBe(true);
    expect(backendVersionSupportsReactions('11.3.1')).toBe(true);
    expect(backendVersionSupportsReactions('12.0.0')).toBe(true);
  });

  test('false for missing or unparseable versions', () => {
    expect(backendVersionSupportsReactions(undefined)).toBe(false);
    expect(backendVersionSupportsReactions(null)).toBe(false);
    expect(backendVersionSupportsReactions('n/a')).toBe(false);
    expect(backendVersionSupportsReactions('')).toBe(false);
  });
});
