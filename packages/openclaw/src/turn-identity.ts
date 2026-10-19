/**
 * Which identity a `tlon` call acts as. The tool defaults to the owner; the
 * before_tool_call gate rewrites every call that is not owner-directed to
 * `--self` (the bot).
 *
 * Rule: a run acts as the owner only when the monitor's pre-dispatch snapshot
 * for its runId says it answers an owner message. Every other run, snapshotless
 * runs included, acts as the bot. The decision is recorded at the run's first
 * observation on any hook or gate path, and only ever moves toward the bot: a
 * non-owner message dispatched on the run's session demotes every run on that
 * session, which also revokes their owner-only tools (the veto treats them as
 * non-owner turns).
 *
 * Lifetime: every hook bumps the run's record. After an hour without activity
 * it becomes a tombstone for seven days: a later attempt under the same runId
 * acts as the bot and is vetoed from owner-only tools, so an owner run idle for
 * an hour loses owner-only tools for the rest of that run, and no run can fall
 * back to a session role that changed since. Retained memory is bounded by seven days of
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
 * - `sessions_send` demotes the target's runs (every tracked session's when
 *   unresolved), except, for an owner-directed caller with a recorded
 *   account, runs on that account or with no recorded account.
 * - The owner's queued follow-ups run under fresh runIds without a snapshot,
 *   so they act as the bot; the owner has to ask again.
 *
 * An owner-directed run also records which ship was the owner when it was
 * first observed. A config reload that reassigns the owner demotes it at its
 * next observation, like a non-owner message would: the commands would
 * otherwise run with the new owner's credentials on the old owner's say-so.
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
/** How long a quiet run's tombstone resolves it to a vetoed bot turn. */
export const RUN_TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type RunRecord = {
  identity: TurnIdentity;
  sessionKey: string;
  /** Sender of the answered message, or the session role at first sight. */
  senderRole?: SenderRole;
  /** The Tlon account the answered message arrived on, when known. */
  accountId?: string;
  /** The configured owner when an owner-directed run was first observed. */
  ownerShip?: string;
  lastSeenAt: number;
};

type Tombstone = { expiresAt: number };

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
  now: number,
  ownerShip?: string
): RunRecord {
  const snapshot = getTlonSessionRunSurface(runId);
  if (snapshot) {
    const identity = snapshot.senderRole === 'owner' ? 'owner' : 'bot';
    return {
      identity,
      sessionKey: snapshot.sessionKey,
      senderRole: snapshot.senderRole ?? 'user',
      ...(snapshot.accountId ? { accountId: snapshot.accountId } : {}),
      ...(identity === 'owner' && ownerShip ? { ownerShip } : {}),
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
 * Returns the identity it resolves to. Callers that know the live configured
 * owner pass it as `ownerShip` (undefined when none is configured, but
 * present): an owner-directed run recorded under a different owner is demoted.
 */
export function observeRun(
  ctx: { runId?: string; sessionKey?: string; ownerShip?: string },
  now = Date.now()
): TurnIdentity {
  const runId = ctx.runId?.trim();
  if (!runId) return 'bot';
  sweep(now);
  if (tombstones.has(runId)) return 'bot';
  const record = activeRuns.get(runId);
  if (!record) {
    return setActive(
      runId,
      firstSight(runId, ctx.sessionKey, now, ctx.ownerShip)
    ).identity;
  }
  const ownerChanged =
    record.identity === 'owner' &&
    Object.hasOwn(ctx, 'ownerShip') &&
    record.ownerShip !== ctx.ownerShip;
  return setActive(
    runId,
    ownerChanged
      ? { ...record, identity: 'bot', senderRole: 'user', lastSeenAt: now }
      : { ...record, lastSeenAt: now }
  ).identity;
}

export const resolveTurnIdentity = observeRun;

/**
 * The role the owner-only veto uses for a run that has been seen: the
 * recorded sender, `'user'` for any tombstone (fail closed), and `null` when
 * the run is active but carries no role. `undefined` only for a run never seen.
 */
export function getRecordedRunRole(
  runId: string | null | undefined
): SenderRole | null | undefined {
  const key = runId?.trim();
  if (!key) return undefined;
  if (tombstones.has(key)) return 'user';
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
 * Demote every active run, and every unstarted snapshot, on a session: identity
 * to the bot and the veto role to a non-owner, so every owner-only tool is
 * refused for the rest of those runs. Roleless runs (subagents, internal and
 * control-UI turns) are included: a non-owner message can be steered into them
 * as well.
 */
function demoteSession(
  canonicalKey: string,
  now: number,
  /** Runs (by recorded account) this demotion leaves alone; none by default. */
  keeps: (accountId: string | undefined) => boolean = () => false
): void {
  for (const [runId, surface] of listTlonSessionRunSurfaces()) {
    if (
      canonicalSessionKey(surface.sessionKey) === canonicalKey &&
      !activeRuns.has(runId) &&
      !tombstones.has(runId) &&
      !keeps(surface.accountId)
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
      canonicalSessionKey(record.sessionKey) === canonicalKey &&
      !keeps(record.accountId)
    ) {
      activeRuns.set(runId, { ...record, identity: 'bot', senderRole: 'user' });
    }
  }
}

/**
 * The monitor is about to dispatch an inbound Tlon message on these session
 * keys, before core can steer it into an active run there. A non-owner message
 * demotes every run on them. An owner message demotes the runs recorded for a
 * different Tlon account (the message's owner is not theirs); runs with no
 * recorded account are left alone by owner messages.
 */
export function noteInboundDispatching(input: {
  sessionKeys: readonly string[];
  role: 'owner' | 'user';
  accountId?: string;
  now?: number;
}): void {
  const now = input.now ?? Date.now();
  sweep(now);
  const keys = new Set(
    input.sessionKeys
      .map((key) => key.trim())
      .filter(Boolean)
      .map(canonicalSessionKey)
  );
  for (const key of keys) {
    if (input.role === 'user') demoteSession(key, now);
    // Runs with no recorded account never act as the owner, so an owner
    // message cannot lend them another account's owner.
    else
      demoteSession(
        key,
        now,
        (accountId) =>
          accountId === undefined || accountId === (input.accountId ?? '')
      );
  }
}

/**
 * Another session's run can be injected into with `sessions_send`. Demote the
 * runs on the target when it is a tracked session; otherwise (labels, session
 * ids, aliases, agent-only addressing) the runs on every tracked session, since
 * the target cannot be resolved here. An owner-directed caller with a recorded
 * account leaves alone target runs on that account or with no recorded account
 * (those never hold owner identity); a non-owner, roleless, unseen or
 * tombstoned caller, a caller with no recorded account, and a target on a
 * different account all demote.
 */
export function noteCrossSessionSend(
  params: unknown,
  callerRunId?: string,
  now = Date.now()
): void {
  sweep(now);
  const caller = callerRunId?.trim();
  const callerRecord = caller ? activeRuns.get(caller) : undefined;
  // Only an owner-directed caller injecting into a run on its own, recorded
  // account is left alone; every other combination demotes.
  const callerAccount =
    callerRecord?.identity === 'owner' ? callerRecord.accountId : undefined;
  // A target with no recorded account never holds owner identity, so an
  // owner caller with an account leaves it alone (the owner driving its own
  // subagent keeps that subagent's tools).
  const keeps = (accountId: string | undefined) =>
    callerAccount !== undefined &&
    (accountId === undefined || accountId === callerAccount);
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
    demoteSession(canonicalTarget, now, keeps);
    return;
  }
  for (const key of trackedSessions) demoteSession(key, now, keeps);
}

export const _testing = {
  clearAll: () => {
    activeRuns.clear();
    tombstones.clear();
  },
  sizes: () => ({ active: activeRuns.size, tombstones: tombstones.size }),
};
