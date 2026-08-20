/**
 * What to do about a pending workspace landing.
 *
 * Pure, and in its own module rather than beside the hook, so the interesting
 * cases — never synced, synced late, no handoff at all — are testable without
 * pulling in the navigator (and, through it, the native module graph).
 */
import type * as db from '@tloncorp/shared/db';

/** How long to wait for the workspace channel to sync before giving up. */
export const WORKSPACE_LANDING_TIMEOUT_MS = 60_000;

export type LandingDecision =
  /** Nothing pending. */
  | { kind: 'idle' }
  /** The channel has not arrived yet; keep waiting. */
  | { kind: 'wait' }
  | { kind: 'navigate'; groupId: string; channelId: string }
  /** Waited long enough. Clear the handoff and leave the user be. */
  | { kind: 'giveUp' };

export function decideLanding({
  landing,
  channelExists,
  elapsedMs,
  timeoutMs = WORKSPACE_LANDING_TIMEOUT_MS,
}: {
  landing: db.WorkspaceLanding;
  channelExists: boolean;
  elapsedMs: number;
  timeoutMs?: number;
}): LandingDecision {
  if (!landing) {
    return { kind: 'idle' };
  }
  if (channelExists) {
    return {
      kind: 'navigate',
      groupId: landing.groupId,
      channelId: landing.channelId,
    };
  }
  // Timeout is checked after existence on purpose: a channel that arrives on
  // the same tick the deadline passes should still be navigated to.
  return elapsedMs >= timeoutMs ? { kind: 'giveUp' } : { kind: 'wait' };
}
