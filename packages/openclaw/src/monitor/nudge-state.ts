/**
 * Per-account in-memory shadows used by the nudge scheduler.
 *
 * The scheduler never consults the subscription-derived settings mirror for
 * its stage guard or owner-activity check; both live here, updated
 * synchronously by the monitor on observable events. See the plan for
 * `TLON-5628` for the invariants these shadows enforce.
 */

import type { NudgeStage } from "../nudge-messages.js";
import type { TlonSettingsStore } from "../settings.js";

export type LastOwnerActivity = {
  at: number;
  date: string;
};

export type LastNudgeStageShadow = 0 | NudgeStage;

const ownerActivity = new Map<string, LastOwnerActivity>();
const stageShadow = new Map<string, LastNudgeStageShadow>();

export function setLastOwnerActivity(accountId: string, activity: LastOwnerActivity | null): void {
  if (activity == null) {
    ownerActivity.delete(accountId);
    return;
  }
  ownerActivity.set(accountId, activity);
}

export function getLastOwnerActivity(accountId: string): LastOwnerActivity | null {
  return ownerActivity.get(accountId) ?? null;
}

export function setLastNudgeStageShadow(accountId: string, stage: LastNudgeStageShadow): void {
  stageShadow.set(accountId, stage);
}

export function getLastNudgeStageShadow(accountId: string): LastNudgeStageShadow | null {
  return stageShadow.get(accountId) ?? null;
}

export function clearShadowsForAccount(accountId: string): void {
  ownerActivity.delete(accountId);
  stageShadow.delete(accountId);
}

/**
 * Derive a seed value for the owner-activity shadow from a loaded
 * settings snapshot. Missing fields seed the shadow as absent.
 */
export function ownerActivityFromSettings(settings: TlonSettingsStore): LastOwnerActivity | null {
  const at = typeof settings.lastOwnerMessageAt === "number" ? settings.lastOwnerMessageAt : null;
  const date =
    typeof settings.lastOwnerMessageDate === "string" ? settings.lastOwnerMessageDate : null;

  if (at != null && date != null) {
    return { at, date };
  }
  if (at != null) {
    return { at, date: new Date(at).toISOString().split("T")[0] ?? "" };
  }
  if (date != null) {
    const parsed = Date.parse(date);
    if (Number.isFinite(parsed)) {
      return { at: parsed, date };
    }
  }
  return null;
}

export const _testing = {
  clearAll: () => {
    ownerActivity.clear();
    stageShadow.clear();
  },
};
