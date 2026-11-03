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

/**
 * Re-derives an allowlist from a settings snapshot. An explicit list (even an
 * empty one) is authoritative; a missing key falls back to the file config
 * rather than keeping the previous in-memory list.
 */
export function resolveSettingsAllowlist(
  settingsValue: string[] | undefined,
  fileValue: string[],
  current: string[]
): { allowlist: string[]; changed: boolean } {
  const allowlist = settingsValue ?? fileValue;
  const changed =
    allowlist.length !== current.length ||
    allowlist.some((ship, i) => ship !== current[i]);
  return { allowlist, changed };
}
