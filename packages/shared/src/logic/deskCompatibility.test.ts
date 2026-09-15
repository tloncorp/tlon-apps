import { describe, expect, test } from 'vitest';

import { MIN_GROUPS_VERSION, classifyDeskVersion } from './deskCompatibility';
import { parseVersion } from './semver';

describe('classifyDeskVersion', () => {
  test('accepts the minimum release and anything above it', () => {
    expect(classifyDeskVersion(MIN_GROUPS_VERSION)).toBe('ok');
    expect(classifyDeskVersion('12.2.0')).toBe('ok');
    expect(classifyDeskVersion('12.2.1')).toBe('ok');
    expect(classifyDeskVersion('13.0.0')).toBe('ok');
  });

  test('gates releases below the minimum', () => {
    expect(classifyDeskVersion('12.1.0')).toBe('outdated');
    expect(classifyDeskVersion('12.0.1')).toBe('outdated');
    expect(classifyDeskVersion('11.4.0')).toBe('outdated');
    expect(classifyDeskVersion('0.0.1')).toBe('outdated');
  });

  test('fails open on anything it cannot fully parse', () => {
    // These must never gate: '12.2.0 dirty' would pass a prefix check and then
    // compare as equal to the minimum inside isVersionBelow, and 'n/a' is what
    // the version scry reports when the docket charge is missing entirely.
    expect(classifyDeskVersion(undefined)).toBe('unknown');
    expect(classifyDeskVersion(null)).toBe('unknown');
    expect(classifyDeskVersion('')).toBe('unknown');
    expect(classifyDeskVersion('n/a')).toBe('unknown');
    expect(classifyDeskVersion('12.2')).toBe('unknown');
    expect(classifyDeskVersion('v12.2.0')).toBe('unknown');
    expect(classifyDeskVersion('12.1.0 dirty')).toBe('unknown');
  });

  test('the minimum itself is a parseable version', () => {
    expect(parseVersion(MIN_GROUPS_VERSION)).not.toBeNull();
  });
});
