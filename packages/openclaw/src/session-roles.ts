/**
 * Tracks sender roles per session for tool access control.
 * Used by the before_tool_call hook to enforce owner-only restrictions.
 *
 * Note: We use sessionKey (not sessionId) because that's what the
 * before_tool_call hook provides. Cleanup happens via TTL, not session_end
 * (which provides sessionId, not sessionKey).
 */

import { sharedMap } from "./shared-state.js";

export type SenderRole = "owner" | "user";

interface RoleEntry {
  role: SenderRole;
  timestamp: number;
}

const sessionRoles = sharedMap<string, RoleEntry>("session-roles");

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

export function getSessionRole(sessionKey: string): SenderRole | undefined {
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

// Exported for testing - allows time manipulation
export const _testing = {
  clearAll: () => sessionRoles.clear(),
  getRoleTtlMs: () => ROLE_TTL_MS,
};
