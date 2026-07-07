import { describe, expect, test } from 'vitest';

import { activityVersionSupportsReactions } from './reactionSupport';

describe('activityVersionSupportsReactions', () => {
  test('false below the minimum (incl. current deployed version)', () => {
    expect(activityVersionSupportsReactions('11.3.0')).toBe(false);
    expect(activityVersionSupportsReactions('11.2.2')).toBe(false);
    expect(activityVersionSupportsReactions('11.0.1')).toBe(false);
    expect(activityVersionSupportsReactions('10.9.9')).toBe(false);
  });

  test('true at or above the minimum', () => {
    expect(activityVersionSupportsReactions('11.4.0')).toBe(true);
    expect(activityVersionSupportsReactions('11.4.1')).toBe(true);
    expect(activityVersionSupportsReactions('12.0.0')).toBe(true);
  });

  test('false for missing or unparseable versions', () => {
    expect(activityVersionSupportsReactions(undefined)).toBe(false);
    expect(activityVersionSupportsReactions(null)).toBe(false);
    expect(activityVersionSupportsReactions('n/a')).toBe(false);
    expect(activityVersionSupportsReactions('')).toBe(false);
  });

  // Regression: a semver-looking prefix with an unsupported suffix (e.g. a
  // 'dirty' docket build below the minimum) must not be treated as
  // reaction-capable. A loose prefix check would admit it, and the failed
  // strict parse inside isVersionBelow would then read as "equal" and return
  // true, pointing an old backend at v9 endpoints it can't serve.
  test('false for partially parseable versions', () => {
    expect(activityVersionSupportsReactions('11.2.2 dirty')).toBe(false);
    expect(activityVersionSupportsReactions('11.2.2-')).toBe(false);
    expect(activityVersionSupportsReactions('11.2.2.3')).toBe(false);
    expect(activityVersionSupportsReactions('11.2')).toBe(false);
    expect(activityVersionSupportsReactions('v11.4.0')).toBe(false);
  });

  test('still respects valid prerelease/build suffixes at or above the minimum', () => {
    expect(activityVersionSupportsReactions('11.4.0-rc.1')).toBe(true);
    expect(activityVersionSupportsReactions('11.4.0+build.5')).toBe(true);
  });
});
