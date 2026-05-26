import { describe, expect, it } from 'vitest';

import { compareSemver, isVersionBelow } from './semver';

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
  });

  it('compares major versions', () => {
    expect(compareSemver('2.0.0', '1.0.0')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '2.0.0')).toBeLessThan(0);
  });

  it('compares minor versions', () => {
    expect(compareSemver('1.2.0', '1.1.0')).toBeGreaterThan(0);
    expect(compareSemver('1.1.0', '1.2.0')).toBeLessThan(0);
  });

  it('compares patch versions', () => {
    expect(compareSemver('1.0.2', '1.0.1')).toBeGreaterThan(0);
    expect(compareSemver('1.0.1', '1.0.2')).toBeLessThan(0);
  });

  it('handles numeric comparison, not lexicographic', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBeGreaterThan(0);
  });

  it('ignores prerelease and build metadata', () => {
    expect(compareSemver('1.2.3-beta', '1.2.3')).toBe(0);
    expect(compareSemver('1.2.3+build.1', '1.2.3')).toBe(0);
  });

  it('returns 0 for unparseable versions (fail-open)', () => {
    expect(compareSemver('not-a-version', '1.0.0')).toBe(0);
    expect(compareSemver('1.0.0', '')).toBe(0);
  });
});

describe('isVersionBelow', () => {
  it('returns true when current is older than minimum', () => {
    expect(isVersionBelow('1.0.0', '1.0.1')).toBe(true);
    expect(isVersionBelow('8.9.0', '9.0.0')).toBe(true);
  });

  it('returns false when current equals minimum', () => {
    expect(isVersionBelow('1.0.0', '1.0.0')).toBe(false);
  });

  it('returns false when current is newer than minimum', () => {
    expect(isVersionBelow('1.0.1', '1.0.0')).toBe(false);
    expect(isVersionBelow('9.0.0', '8.9.0')).toBe(false);
  });

  it('returns false when versions cannot be parsed (fail-open)', () => {
    expect(isVersionBelow('garbage', '1.0.0')).toBe(false);
  });
});
