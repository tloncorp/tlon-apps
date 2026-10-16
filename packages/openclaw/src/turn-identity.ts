/**
 * Which identity a `tlon` call acts as. The tool defaults to the owner; the
 * before_tool_call gate rewrites every call that is not owner-directed to
 * `--self` (the bot).
 *
 * Rule: a run acts as the owner only when the monitor's pre-dispatch snapshot
 * for its runId says it answers an owner message. Every other run, snapshotless
 * runs included, acts as the bot. The decision is recorded at the run's first
 * observation on any hook or gate path, and only ever moves toward the bot: a
 * non-owner message dispatched on the run's session demotes it, which also
 * revokes the run's owner-only tools (the veto treats it as a non-owner turn).
 *
 * Lifetime: every hook bumps the run's record. After an hour without activity
 * it becomes a tombstone that resolves to the bot for seven days, so a later
 * attempt under the same runId cannot regain owner identity or fall back to a
 * session role that changed since. Retained memory is bounded by seven days of
 * runs (about 10,000 tombstones at one run a minute), each a runId and a
 * number; pruning sweeps only expired entries, oldest first.
 *
 * Accepted limitations, by design:
 * - When another channel is enabled and shares the main session (core's
 *   default DM scope), a non-owner message from that channel steered into an
 *   active owner-directed run is not seen by the plugin and does not demote
 *   it. Hosted Tlon bots run the Tlon channel only.
 * - Control-UI and gateway `chat.send` input is trusted operator input; its
 *   runs have no snapshot and act as the bot.
 * - Run snapshots and the onboarding publication claims bound to them are kept
 *   across attempts and expire by TTL, not at `agent_end`.
 * - The owner's queued follow-ups run under fresh runIds without a snapshot,
 *   so they act as the bot; the owner has to ask again.
 */
import {
  getTlonSessionRunSurface,
  listTlonSessionRunSurfaces,
} from './onboarding-tool-boundary.js';
import { type SenderRole, getSessionRole } from './session-roles.js';
import { sharedMap } from './shared-state.js';

export type TurnIdentity = 'owner' | 'bot';

/** A run's record stays active for this long after its last hook. */
export const RUN_ACTIVE_TTL_MS = 60 * 60 * 1000;
/** How long a quiet run's tombstone resolves it to the bot. */
export const RUN_TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type RunRecord = {
  identity: TurnIdentity;
  sessionKey: string;
  /** Sender of the answered message, or the session role at first sight. */
  senderRole?: SenderRole;
  /** The Tlon account the answered message arrived on, when known. */
  accountId?: string;
  lastSeenAt: number;
};

type Tombstone = { expiresAt: number; nonOwner?: true };

// Insertion order is lastSeenAt order (a bump re-inserts), and tombstones are
// created in that same order, so both sweeps stop at the first live entry.
const activeRuns = sharedMap<string, RunRecord>('turn-identity-active-runs');
const tombstones = sharedMap<string, Tombstone>('turn-identity-tombstones');

/** Thread sessions (`…:thread:<id>`) share their parent's identity state. */
export function canonicalSessionKey(sessionKey: string): string {
  const key = sessionKey.trim();
  const threadIndex = key.indexOf(':thread:');
  return threadIndex > 0 ? key.slice(0, threadIndex) : key;
}

function sweep(now: number): void {
  for (const [runId, record] of activeRuns) {
    if (now - record.lastSeenAt < RUN_ACTIVE_TTL_MS) break;
    activeRuns.delete(runId);
    tombstones.set(runId, {
      expiresAt: record.lastSeenAt + RUN_ACTIVE_TTL_MS + RUN_TOMBSTONE_TTL_MS,
      ...(record.senderRole === 'user' ? { nonOwner: true as const } : {}),
    });
  }
  for (const [runId, tombstone] of tombstones) {
    if (tombstone.expiresAt > now) break;
    tombstones.delete(runId);
  }
}

function setActive(runId: string, record: RunRecord): RunRecord {
  activeRuns.delete(runId);
  activeRuns.set(runId, record);
  return record;
}

function firstSight(
  runId: string,
  sessionKey: string | undefined,
  now: number
): RunRecord {
  const snapshot = getTlonSessionRunSurface(runId);
  if (snapshot) {
    return {
      identity: snapshot.senderRole === 'owner' ? 'owner' : 'bot',
      sessionKey: snapshot.sessionKey,
      senderRole: snapshot.senderRole ?? 'user',
      ...(snapshot.accountId ? { accountId: snapshot.accountId } : {}),
      lastSeenAt: now,
    };
  }
  const key = sessionKey?.trim() ?? '';
  const sessionRole = key ? getSessionRole(key) : undefined;
  return {
    identity: 'bot',
    sessionKey: key,
    ...(sessionRole ? { senderRole: sessionRole } : {}),
    lastSeenAt: now,
  };
}

/**
 * Any hook or gate call for a run: record it at first sight, bump it after.
 * Returns the identity it resolves to.
 */
export function observeRun(
  ctx: { runId?: string; sessionKey?: string },
  now = Date.now()
): TurnIdentity {
  const runId = ctx.runId?.trim();
  if (!runId) return 'bot';
  sweep(now);
  if (tombstones.has(runId)) return 'bot';
  const record = activeRuns.get(runId);
  return setActive(
    runId,
    record
      ? { ...record, lastSeenAt: now }
      : firstSight(runId, ctx.sessionKey, now)
  ).identity;
}

export const resolveTurnIdentity = observeRun;

/**
 * The role the owner-only veto uses for a run that has been seen: the
 * recorded sender, `'user'` for a non-owner tombstone, and `null` when the run
 * is known but carries no role. `undefined` only for a run never seen.
 */
export function getRecordedRunRole(
  runId: string | null | undefined
): SenderRole | null | undefined {
  const key = runId?.trim();
  if (!key) return undefined;
  const tombstone = tombstones.get(key);
  if (tombstone) return tombstone.nonOwner ? 'user' : null;
  const record = activeRuns.get(key);
  return record ? (record.senderRole ?? null) : undefined;
}

/** The Tlon account a run's answered message arrived on, when recorded. */
export function getRunAccountId(
  runId: string | null | undefined
): string | undefined {
  const key = runId?.trim();
  return key ? activeRuns.get(key)?.accountId : undefined;
}

/**
 * Demote the active owner runs, and unstarted owner snapshots, on a session:
 * identity to the bot and the veto role to a non-owner, so every owner-only
 * tool is refused for the rest of the run, not only owner identity.
 */
function demoteSession(canonicalKey: string, now: number): void {
  for (const [runId, surface] of listTlonSessionRunSurfaces()) {
    if (
      surface.senderRole === 'owner' &&
      canonicalSessionKey(surface.sessionKey) === canonicalKey &&
      !activeRuns.has(runId) &&
      !tombstones.has(runId)
    ) {
      setActive(runId, {
        ...firstSight(runId, undefined, now),
        identity: 'bot',
        senderRole: 'user',
      });
    }
  }
  for (const [runId, record] of activeRuns) {
    if (
      (record.identity === 'owner' || record.senderRole === 'owner') &&
      canonicalSessionKey(record.sessionKey) === canonicalKey
    ) {
      activeRuns.set(runId, { ...record, identity: 'bot', senderRole: 'user' });
    }
  }
}

/**
 * The monitor is about to dispatch an inbound Tlon message on these session
 * keys. A non-owner message demotes the owner runs on them before core can
 * steer it into one of those runs.
 */
export function noteInboundDispatching(input: {
  sessionKeys: readonly string[];
  role: 'owner' | 'user';
  now?: number;
}): void {
  if (input.role !== 'user') return;
  const now = input.now ?? Date.now();
  sweep(now);
  const keys = new Set(
    input.sessionKeys
      .map((key) => key.trim())
      .filter(Boolean)
      .map(canonicalSessionKey)
  );
  for (const key of keys) demoteSession(key, now);
}

/**
 * Another session's run can be injected into with `sessions_send`. Demote the
 * owner runs on the target when it is a tracked session; otherwise (labels,
 * session ids, aliases, agent-only addressing) demote every owner run, since
 * the target cannot be resolved here.
 */
export function noteCrossSessionSend(params: unknown, now = Date.now()): void {
  sweep(now);
  const target =
    params && typeof params === 'object'
      ? (params as { sessionKey?: unknown }).sessionKey
      : undefined;
  const canonicalTarget =
    typeof target === 'string' && target.trim()
      ? canonicalSessionKey(target)
      : undefined;
  const trackedSessions = new Set<string>();
  for (const [, surface] of listTlonSessionRunSurfaces()) {
    trackedSessions.add(canonicalSessionKey(surface.sessionKey));
  }
  for (const [, record] of activeRuns) {
    if (record.sessionKey) {
      trackedSessions.add(canonicalSessionKey(record.sessionKey));
    }
  }
  if (canonicalTarget !== undefined && trackedSessions.has(canonicalTarget)) {
    demoteSession(canonicalTarget, now);
    return;
  }
  for (const key of trackedSessions) demoteSession(key, now);
}

export const _testing = {
  clearAll: () => {
    activeRuns.clear();
    tombstones.clear();
  },
  sizes: () => ({ active: activeRuns.size, tombstones: tombstones.size }),
};
