import { describe, expect, it } from 'vitest';

import { isVersionBelow } from './semver';

describe('isVersionBelow', () => {
  it('returns true when current is older than minimum', () => {
    expect(isVersionBelow('1.0.0', '1.0.1')).toBe(true);
    expect(isVersionBelow('1.1.0', '1.2.0')).toBe(true);
    expect(isVersionBelow('8.9.0', '9.0.0')).toBe(true);
  });

  it('returns false when current equals minimum', () => {
    expect(isVersionBelow('1.0.0', '1.0.0')).toBe(false);
  });

  it('returns false when current is newer than minimum', () => {
    expect(isVersionBelow('1.0.1', '1.0.0')).toBe(false);
    expect(isVersionBelow('1.2.0', '1.1.0')).toBe(false);
    expect(isVersionBelow('9.0.0', '8.9.0')).toBe(false);
  });

  it('compares components numerically, not lexicographically', () => {
    expect(isVersionBelow('1.9.0', '1.10.0')).toBe(true);
    expect(isVersionBelow('1.10.0', '1.9.0')).toBe(false);
  });

  it('treats prerelease and build metadata as equal to the core version', () => {
    expect(isVersionBelow('1.2.3-beta', '1.2.3')).toBe(false);
    expect(isVersionBelow('1.2.3', '1.2.3-beta')).toBe(false);
    expect(isVersionBelow('1.2.3+build.1', '1.2.3')).toBe(false);
  });

  it('returns false when versions cannot be parsed (fail-open)', () => {
    expect(isVersionBelow('garbage', '1.0.0')).toBe(false);
    expect(isVersionBelow('1.0.0', '')).toBe(false);
  });

  it('rejects core versions with empty prerelease or build suffix', () => {
    expect(isVersionBelow('1.2.3-', '1.2.4')).toBe(false);
    expect(isVersionBelow('1.2.3+', '1.2.4')).toBe(false);
    expect(isVersionBelow('1.2.4', '1.2.3-')).toBe(false);
  });
});
