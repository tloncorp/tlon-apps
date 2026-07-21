import { sharedMap } from './shared-state.js';

export type TlonAuthPhase = 'startup' | 're_auth';

export const AUTH_PLUGIN_ERROR_GRACE_MS = 3 * 60_000;

type AuthRetryState = {
  startedAtMs: number;
  attempt: number;
};

export type AuthRetryFailure = {
  attempt: number;
  downMs: number;
  shouldCapturePluginError: boolean;
};

// Shared across isolated plugin module contexts and channel restarts in the
// same gateway process. The phase is deliberately not part of the key so a
// failed SSE re-auth that falls back to a full monitor start remains one
// continuous outage.
const authRetryStates = sharedMap<string, AuthRetryState>(
  'monitor.authRetryStates'
);

export function authRetryStateKey(params: {
  accountId: string | null;
  botShip: string;
}): string {
  return `${params.accountId ?? 'default'}:${params.botShip}`;
}

export function recordAuthRetryFailure(
  key: string,
  nowMs = Date.now()
): AuthRetryFailure {
  const current = authRetryStates.get(key);
  const next: AuthRetryState = current
    ? { ...current, attempt: current.attempt + 1 }
    : { startedAtMs: nowMs, attempt: 1 };
  authRetryStates.set(key, next);

  const downMs = Math.max(0, nowMs - next.startedAtMs);
  return {
    attempt: next.attempt,
    downMs,
    shouldCapturePluginError: downMs >= AUTH_PLUGIN_ERROR_GRACE_MS,
  };
}

export function clearAuthRetryState(key: string): void {
  authRetryStates.delete(key);
}
