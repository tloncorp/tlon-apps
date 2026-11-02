import { describe, expect, test } from 'vitest';

import {
  DESK_CAPABILITIES,
  type DeskCapability,
  parseVersion,
  versionSupports,
} from '../lib/deskVersion';

const capabilities = Object.keys(DESK_CAPABILITIES) as DeskCapability[];

describe('versionSupports', () => {
  test.each(capabilities)('%s is on from its release', (capability) => {
    const [major, minor, patch] = parseVersion(DESK_CAPABILITIES[capability])!;
    expect(versionSupports(DESK_CAPABILITIES[capability], capability)).toBe(
      true
    );
    expect(versionSupports(`${major}.${minor}.${patch + 1}`, capability)).toBe(
      true
    );
    expect(versionSupports(`${major + 1}.0.0`, capability)).toBe(true);
  });

  test('is off below the release', () => {
    expect(versionSupports('12.2.0', 'buckets')).toBe(false);
    expect(versionSupports('12.3.0', 'automations')).toBe(false);
    expect(versionSupports('12.4.1', 'rosterPages')).toBe(false);
    expect(versionSupports('11.3.0', 'activityReactions')).toBe(false);
  });

  // A loose prefix check would admit '12.5.0 dirty', and isVersionBelow
  // treats an unparseable version as equal to the minimum.
  test('is off for a version it cannot fully parse', () => {
    for (const version of [
      '12.5.0 dirty',
      'n/a',
      '12.5',
      '',
      null,
      undefined,
    ]) {
      expect(versionSupports(version, 'stewardBots')).toBe(false);
    }
  });

  test('accepts a prerelease or build suffix', () => {
    expect(versionSupports('12.5.0-rc.1', 'stewardBots')).toBe(true);
  });
});
