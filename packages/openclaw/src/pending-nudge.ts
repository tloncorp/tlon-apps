/**
 * Pending nudge shared state for heartbeat re-engagement attribution.
 *
 * When the plugin-driven scheduler sends a re-engagement nudge, a
 * PendingNudge record is stored here. If the owner replies within the
 * attribution window, the monitor emits a re-engagement event, injects the
 * nudge content as context for the agent, and clears the record.
 *
 * Keyed by accountId — each account has at most one pending nudge at a
 * time. Per-account persist callbacks route writes to the correct ship's
 * settings store.
 */

export type PendingNudge = {
  sentAt: number;
  stage: 1 | 2 | 3;
  ownerShip: string;
  accountId: string;
  /** The exact nudge message text, used to inject reply context for the agent. */
  content?: string;
};

/** Default re-engagement attribution window: 72 hours */
export const DEFAULT_ATTRIBUTION_WINDOW_MS = 72 * 60 * 60 * 1000;

const pendingNudges = new Map<string, PendingNudge>();
const persistCallbacks = new Map<string, (nudge: PendingNudge | null) => void>();

export function setPendingNudge(accountId: string, nudge: PendingNudge): void {
  pendingNudges.set(accountId, nudge);
  persistCallbacks.get(accountId)?.(nudge);
}

export function getPendingNudge(accountId: string): PendingNudge | null {
  return pendingNudges.get(accountId) ?? null;
}

export function clearPendingNudge(accountId: string): void {
  pendingNudges.delete(accountId);
  persistCallbacks.get(accountId)?.(null);
}

export function registerPersistCallback(
  accountId: string,
  cb: (nudge: PendingNudge | null) => void,
): void {
  persistCallbacks.set(accountId, cb);
}

/**
 * Sync from settings store (startup load or hot-reload).
 * Does NOT trigger persist callback — the data came from the store.
 */
export function syncPendingNudgeFromStore(accountId: string, nudge: PendingNudge | null): void {
  if (nudge) {
    pendingNudges.set(accountId, nudge);
  } else {
    pendingNudges.delete(accountId);
  }
}

/**
 * Returns true if the pending nudge is still within the attribution window.
 * @param nowMs - current time in epoch ms (injectable for tests)
 * @param windowMs - attribution window in ms (overridable, defaults to 72h)
 */
export function isNudgeEligible(
  nudge: PendingNudge,
  nowMs: number = Date.now(),
  windowMs: number = DEFAULT_ATTRIBUTION_WINDOW_MS,
): boolean {
  return nowMs - nudge.sentAt <= windowMs;
}

export const _testing = {
  clearAll: () => {
    pendingNudges.clear();
    persistCallbacks.clear();
  },
};
