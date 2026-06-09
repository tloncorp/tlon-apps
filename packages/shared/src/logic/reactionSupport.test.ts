import { describe, expect, test } from 'vitest';

import { activityVersionSupportsReactions } from './reactionSupport';

describe('activityVersionSupportsReactions', () => {
  test('false below the minimum (incl. current deployed version)', () => {
    expect(activityVersionSupportsReactions('11.2.2')).toBe(false);
    expect(activityVersionSupportsReactions('11.0.1')).toBe(false);
    expect(activityVersionSupportsReactions('10.9.9')).toBe(false);
  });

  test('true at or above the minimum', () => {
    expect(activityVersionSupportsReactions('11.3.0')).toBe(true);
    expect(activityVersionSupportsReactions('11.3.1')).toBe(true);
    expect(activityVersionSupportsReactions('12.0.0')).toBe(true);
  });

  test('false for missing or unparseable versions', () => {
    expect(activityVersionSupportsReactions(undefined)).toBe(false);
    expect(activityVersionSupportsReactions(null)).toBe(false);
    expect(activityVersionSupportsReactions('n/a')).toBe(false);
    expect(activityVersionSupportsReactions('')).toBe(false);
  });
});
