/**
 * Pure helper for settings mirror synchronization.
 *
 * Detects pendingNudge transitions from the settings mirror.
 * The scheduler no longer routes through this helper for lastNudgeStage —
 * the authoritative stage lives in a fresh scry plus a local shadow.
 */
import type { PendingNudge } from '../pending-nudge.js';
import type { TlonSettingsStore } from '../settings.js';

export type SettingsMirrorSyncResult = {
  pendingNudgeChanged: boolean;
  pendingNudge: PendingNudge | null;
};

export function resolveSettingsMirrorSync(params: {
  prevSettings: TlonSettingsStore;
  newSettings: TlonSettingsStore;
}): SettingsMirrorSyncResult {
  const { prevSettings, newSettings } = params;

  // pendingNudge: reference equality since applySettingsUpdate uses shallow spread
  const pendingNudgeChanged =
    prevSettings.pendingNudge !== newSettings.pendingNudge;
  const pendingNudge: PendingNudge | null = newSettings.pendingNudge ?? null;

  return {
    pendingNudgeChanged,
    pendingNudge,
  };
}
