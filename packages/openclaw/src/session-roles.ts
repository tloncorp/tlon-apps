/** Run-scoped sender roles for the owner-only tool gate. */
import { sharedMap } from './shared-state.js';

export type SenderRole = 'owner' | 'user';

type SessionRunContext = {
  sessionKey?: string;
  sessionId?: string;
  runId?: string;
  trigger?: string;
};

type RunRole = {
  sessionKeys: string[];
  role: SenderRole;
};

const runRoles = sharedMap<string, RunRole>('session-roles.runs');
const tlonSessions = sharedMap<string, true>('session-roles.tlon-sessions');
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

export function recordSenderRole(
  runId: string,
  sessionKeys: string[],
  role: SenderRole
): void {
  for (const key of sessionKeys) tlonSessions.set(key, true);
  runRoles.set(runId, { sessionKeys, role });
}

/** System-event queues are process-local; keep provenance for their lifetime. */
export function recordExternalSessionEvent(sessionKey: string): void {
  externalEventSessions.set(sessionKey, true);
  tlonSessions.set(sessionKey, true);
}

/** Record only host-provided context and session-store metadata. */
export function recordSessionRunContext(
  ctx: SessionRunContext,
  heartbeatSession?: {
    sessionId: string;
    heartbeatIsolatedBaseSessionKey?: string;
  }
): void {
  if (!ctx.runId || !ctx.sessionKey) return;
  // Sender attribution and prepare-hook verification survive later model hooks.
  if (runRoles.has(ctx.runId)) return;
  if (ctx.trigger !== 'cron' && ctx.trigger !== 'heartbeat') return;

  const base = heartbeatSession?.heartbeatIsolatedBaseSessionKey;
  const trustedHeartbeat =
    ctx.trigger === 'heartbeat' &&
    base &&
    ctx.sessionId === heartbeatSession?.sessionId &&
    ctx.sessionKey === `${base}:heartbeat` &&
    !externalEventSessions.has(base) &&
    !externalEventSessions.has(ctx.sessionKey);
  runRoles.set(ctx.runId, {
    sessionKeys: [ctx.sessionKey],
    role: ctx.trigger === 'cron' || trustedHeartbeat ? 'owner' : 'user',
  });
}

export function clearSessionRunContext(ctx: SessionRunContext): void {
  if (!ctx.runId || !ctx.sessionKey) return;
  const run = runRoles.get(ctx.runId);
  if (run && matchesSession(run.sessionKeys, ctx.sessionKey)) {
    runRoles.delete(ctx.runId);
  }
}

export function clearSessionRuns(): void {
  runRoles.clear();
}

export function getToolCallRole(
  ctx: SessionRunContext
): SenderRole | undefined {
  if (!ctx.sessionKey) return 'user';
  const run = ctx.runId ? runRoles.get(ctx.runId) : undefined;
  if (run && matchesSession(run.sessionKeys, ctx.sessionKey)) return run.role;
  // An unclassified/queued run must never borrow another sender's privileges.
  if (
    matchesSession(tlonSessions.keys(), ctx.sessionKey) ||
    ctx.sessionKey.includes(':tlon:') ||
    ctx.sessionKey.endsWith(':heartbeat')
  ) {
    return 'user';
  }
  return undefined;
}

export const _testing = {
  clearAll: () => {
    runRoles.clear();
    tlonSessions.clear();
    externalEventSessions.clear();
  },
};
