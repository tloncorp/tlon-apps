/** Run-scoped sender roles for the owner-only tool gate. */
import { sharedMap } from './shared-state.js';

export type SenderRole = 'owner' | 'user';

type SessionRunContext = {
  sessionKey?: string;
  sessionId?: string;
  agentId?: string;
  jobId?: string;
  runId?: string;
  trigger?: string;
};

type RunRole = {
  sessionKeys: string[];
  role: SenderRole;
};

const runRoles = sharedMap<string, RunRole>('session-roles.runs');
const pendingNonOwnerDispatches = sharedMap<string, string[]>(
  'session-roles.pending-non-owner-dispatches'
);
const externalEventSessions = sharedMap<string, true>(
  'session-roles.external-events'
);

function matchesSession(keys: Iterable<string>, sessionKey: string): boolean {
  for (const key of keys) {
    if (sessionKey === key || sessionKey.startsWith(`${key}:thread:`)) {
      return true;
    }
  }
  return false;
}

function sessionsOverlap(left: string[], right: string[]): boolean {
  return left.some(
    (key) =>
      matchesSession(right, key) ||
      right.some((other) => matchesSession([key], other))
  );
}

function storeRunRole(
  runId: string,
  sessionKeys: string[],
  role: SenderRole
): void {
  const hasPendingInput = Array.from(pendingNonOwnerDispatches.values()).some(
    (keys) => sessionsOverlap(keys, sessionKeys)
  );
  runRoles.set(runId, {
    sessionKeys,
    role:
      hasPendingInput || runRoles.get(runId)?.role === 'user' ? 'user' : role,
  });
}

export function recordSenderRole(
  runId: string,
  sessionKeys: string[],
  role: SenderRole
): void {
  if (role === 'user') {
    // Keep the restriction through dispatch: the host can publish an active
    // steering target before its first plugin hook registers the run.
    pendingNonOwnerDispatches.set(runId, sessionKeys);
    for (const run of runRoles.values()) {
      if (sessionsOverlap(run.sessionKeys, sessionKeys)) run.role = 'user';
    }
  }
  storeRunRole(runId, sessionKeys, role);
}

/** Dispatch completion, including its steering/queue decision, releases input. */
export function finishSenderDispatch(ctx: SessionRunContext): void {
  const keys = ctx.runId ? pendingNonOwnerDispatches.get(ctx.runId) : undefined;
  if (
    ctx.runId &&
    keys &&
    (!ctx.sessionKey || matchesSession(keys, ctx.sessionKey))
  ) {
    pendingNonOwnerDispatches.delete(ctx.runId);
  }
  clearSessionRunContext(ctx);
}

/** System-event queues are process-local; keep provenance for their lifetime. */
export function recordExternalSessionEvent(sessionKey: string): void {
  externalEventSessions.set(sessionKey, true);
}

/** Record only host-provided context and session-store metadata. */
export function recordSessionRunContext(
  ctx: SessionRunContext,
  source?: {
    heartbeatSession?: {
      sessionId: string;
      heartbeatIsolatedBaseSessionKey?: string;
    };
    cronJob?: { id: string; sessionTarget?: string };
  }
): void {
  if (!ctx.runId || !ctx.sessionKey) return;
  // Sender attribution and prepare-hook verification survive later model hooks.
  if (runRoles.has(ctx.runId)) return;
  if (ctx.trigger !== 'cron' && ctx.trigger !== 'heartbeat') return;

  const heartbeatSession = source?.heartbeatSession;
  const base = heartbeatSession?.heartbeatIsolatedBaseSessionKey;
  const trustedHeartbeat =
    ctx.trigger === 'heartbeat' &&
    base &&
    ctx.sessionId === heartbeatSession?.sessionId &&
    ctx.sessionKey === `${base}:heartbeat` &&
    !externalEventSessions.has(base) &&
    !externalEventSessions.has(ctx.sessionKey);
  const trustedCron =
    ctx.trigger === 'cron' &&
    ctx.agentId &&
    ctx.jobId &&
    ctx.sessionId &&
    source?.cronJob?.id === ctx.jobId &&
    source.cronJob.sessionTarget === 'isolated' &&
    ctx.sessionKey ===
      `agent:${ctx.agentId}:cron:${ctx.jobId}:run:${ctx.sessionId}` &&
    !externalEventSessions.has(ctx.sessionKey);
  storeRunRole(
    ctx.runId,
    [ctx.sessionKey],
    trustedCron || trustedHeartbeat ? 'owner' : 'user'
  );
}

export function clearSessionRunContext(
  ctx: SessionRunContext,
  event?: { runId?: string }
): void {
  const runId = ctx.runId ?? event?.runId;
  if (!runId) return;
  const run = runRoles.get(runId);
  if (
    run &&
    (!ctx.sessionKey || matchesSession(run.sessionKeys, ctx.sessionKey))
  ) {
    runRoles.delete(runId);
  }
}

export function clearSessionRuns(): void {
  runRoles.clear();
  pendingNonOwnerDispatches.clear();
}

export function getToolCallRole(ctx: SessionRunContext): SenderRole {
  if (!ctx.sessionKey) return 'user';
  const run = ctx.runId ? runRoles.get(ctx.runId) : undefined;
  return run && matchesSession(run.sessionKeys, ctx.sessionKey)
    ? run.role
    : 'user';
}

export const _testing = {
  clearAll: () => {
    runRoles.clear();
    pendingNonOwnerDispatches.clear();
    externalEventSessions.clear();
  },
};
