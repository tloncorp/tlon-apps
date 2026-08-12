import { describe, expect, it } from 'vitest';

import type { PendingNudge } from '../pending-nudge.js';
import type { TlonSettingsStore } from '../settings.js';
import { resolveSettingsMirrorSync } from './settings-sync.js';

function makeNudge(overrides?: Partial<PendingNudge>): PendingNudge {
  return {
    sentAt: Date.now(),
    stage: 1,
    ownerShip: '~sampel-palnet',
    accountId: 'default',
    ...overrides,
  };
}

describe('resolveSettingsMirrorSync', () => {
  describe('pendingNudge transitions', () => {
    it('detects pendingNudge added', () => {
      const nudge = makeNudge();
      const result = resolveSettingsMirrorSync({
        prevSettings: {},
        newSettings: { pendingNudge: nudge },
      });
      expect(result.pendingNudgeChanged).toBe(true);
      expect(result.pendingNudge).toEqual(nudge);
    });

    it('detects pendingNudge deleted', () => {
      const nudge = makeNudge();
      const result = resolveSettingsMirrorSync({
        prevSettings: { pendingNudge: nudge },
        newSettings: {},
      });
      expect(result.pendingNudgeChanged).toBe(true);
      expect(result.pendingNudge).toBeNull();
    });

    it('unchanged pendingNudge (same reference) returns false', () => {
      const nudge = makeNudge();
      const settings: TlonSettingsStore = { pendingNudge: nudge };
      const result = resolveSettingsMirrorSync({
        prevSettings: settings,
        newSettings: settings,
      });
      expect(result.pendingNudgeChanged).toBe(false);
    });

    it('replaced pendingNudge (different reference) returns true', () => {
      const old = makeNudge({ stage: 1 });
      const replacement = makeNudge({ stage: 2 });
      const result = resolveSettingsMirrorSync({
        prevSettings: { pendingNudge: old },
        newSettings: { pendingNudge: replacement },
      });
      expect(result.pendingNudgeChanged).toBe(true);
      expect(result.pendingNudge).toEqual(replacement);
    });
  });

  describe('edge cases', () => {
    it('first onChange after startup with no new fields', () => {
      const result = resolveSettingsMirrorSync({
        prevSettings: {},
        newSettings: {
          dmAllowlist: ['~ship'],
          ownerShip: '~stale-settings-owner',
        },
      });
      expect(result.pendingNudgeChanged).toBe(false);
      expect(result).not.toHaveProperty('ownerShipChanged');
      expect(result).not.toHaveProperty('effectiveOwnerShip');
    });
  });
});
