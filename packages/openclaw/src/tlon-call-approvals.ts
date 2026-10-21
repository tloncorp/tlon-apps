/**
 * The identity config the before_tool_call gate validated a `tlon` call
 * against, handed to the executor for that same call. The gate and the
 * executor each read the live config; a channels.tlon reload between them
 * could otherwise run a call with an owner or a flag value the gate never
 * approved (a call allowed with the flag off executing owner-default, or one
 * approved for owner A running with B's credentials).
 *
 * Keyed by the host's tool call id, which core passes to both the hook event
 * and the tool's execute, together with the command the gate let through, so
 * two runs reusing a model-generated call id cannot take each other's
 * approval unless they also ran the identical command. Each approval is taken
 * once.
 */
import { sharedMap } from './shared-state.js';

export type TlonCallApproval = {
  ownerDefault: boolean;
  ownerShip: string | undefined;
  /**
   * The run the gate let act as the owner (no `--self` rewrite), for the
   * executor to re-check just before the CLI runs; absent when the call was
   * not an owner run.
   */
  ownerRun?: { runId?: string; sessionKey?: string };
};

/**
 * Long enough for a plugin approval prompt between the gate and the execute;
 * a call that outlives it runs as the bot.
 */
export const TLON_CALL_APPROVAL_TTL_MS = 15 * 60 * 1000;

type Entry = TlonCallApproval & { expiresAt: number };

// Insertion order is expiry order (fixed TTL), so the sweep stops at the
// first live entry.
const approvals = sharedMap<string, Entry>('tlon-call-approvals');

function approvalKey(toolCallId: string, command: string): string {
  return `${toolCallId}\u0000${command}`;
}

function sweep(now: number): void {
  for (const [key, entry] of approvals) {
    if (entry.expiresAt > now) break;
    approvals.delete(key);
  }
}

export function recordTlonCallApproval(
  toolCallId: string,
  command: string,
  approval: TlonCallApproval,
  now = Date.now()
): void {
  sweep(now);
  const key = approvalKey(toolCallId, command);
  approvals.delete(key);
  approvals.set(key, {
    ...approval,
    expiresAt: now + TLON_CALL_APPROVAL_TTL_MS,
  });
}

export function takeTlonCallApproval(
  toolCallId: string,
  command: string,
  now = Date.now()
): TlonCallApproval | undefined {
  sweep(now);
  const key = approvalKey(toolCallId, command);
  const entry = approvals.get(key);
  if (!entry) return undefined;
  approvals.delete(key);
  return {
    ownerDefault: entry.ownerDefault,
    ownerShip: entry.ownerShip,
    ...(entry.ownerRun ? { ownerRun: entry.ownerRun } : {}),
  };
}

export const _testing = {
  clearAll: () => approvals.clear(),
};
