/**
 * Tracks sender roles per session for tool access control.
 * Used by the before_tool_call hook to enforce owner-only restrictions.
 *
 * Note: We use sessionKey (not sessionId) because that's what the
 * before_tool_call hook provides. Cleanup happens via TTL, not session_end
 * (which provides sessionId, not sessionKey).
 */
import { sharedMap } from './shared-state.js';

export type SenderRole = 'owner' | 'user';

interface RoleEntry {
  role: SenderRole;
  timestamp: number;
}

const sessionRoles = sharedMap<string, RoleEntry>('session-roles');
const internalRuns = sharedMap<string, string>('session-roles.internal-runs');

type SessionRunContext = {
  sessionKey?: string;
  runId?: string;
  trigger?: string;
};

/** Record only host-provided agent context, never model-authored tool params. */
export function recordSessionRunContext(ctx: SessionRunContext): void {
  if (!ctx.runId || !ctx.sessionKey || !ctx.trigger) return;
  if (ctx.trigger === 'cron' || ctx.trigger === 'heartbeat') {
    internalRuns.set(ctx.runId, ctx.sessionKey);
  } else {
    clearSessionRunContext(ctx);
  }
}

export function clearSessionRunContext(ctx: SessionRunContext): void {
  if (ctx.runId && internalRuns.get(ctx.runId) === ctx.sessionKey) {
    internalRuns.delete(ctx.runId);
  }
}

export function clearInternalSessionRuns(): void {
  internalRuns.clear();
}

export function getToolCallRole(
  ctx: SessionRunContext
): SenderRole | undefined {
  // A main-session cron/heartbeat may share a key with a non-owner turn.
  // Exempt only the exact trusted run, preserving the stored sender role for
  // concurrent and subsequent interactive turns using the same session.
  if (
    ctx.runId &&
    ctx.sessionKey &&
    internalRuns.get(ctx.runId) === ctx.sessionKey
  ) {
    return undefined;
  }
  return getSessionRole(ctx.sessionKey ?? '');
}

// TTL for role entries (1 hour - sessions shouldn't last longer)
const ROLE_TTL_MS = 60 * 60 * 1000;

export function setSessionRole(sessionKey: string, role: SenderRole): void {
  // Clean up old entries while we're here
  const now = Date.now();
  for (const [key, entry] of sessionRoles) {
    if (now - entry.timestamp > ROLE_TTL_MS) {
      sessionRoles.delete(key);
    }
  }

  sessionRoles.set(sessionKey, { role, timestamp: now });
}

function lookupSessionRole(sessionKey: string): SenderRole | undefined {
  const entry = sessionRoles.get(sessionKey);
  if (!entry) {
    return undefined;
  }

  // Check TTL
  if (Date.now() - entry.timestamp > ROLE_TTL_MS) {
    sessionRoles.delete(sessionKey);
    return undefined;
  }

  return entry.role;
}

export function getSessionRole(sessionKey: string): SenderRole | undefined {
  const direct = lookupSessionRole(sessionKey);
  if (direct) {
    return direct;
  }
  // Thread sessions append `:thread:<id>` to the parent key; the role was
  // stored under the parent.
  const threadIndex = sessionKey.indexOf(':thread:');
  if (threadIndex > 0) {
    return lookupSessionRole(sessionKey.slice(0, threadIndex));
  }
  return undefined;
}

// Exported for testing - allows time manipulation
export const _testing = {
  clearAll: () => {
    sessionRoles.clear();
    internalRuns.clear();
  },
  getRoleTtlMs: () => ROLE_TTL_MS,
};
