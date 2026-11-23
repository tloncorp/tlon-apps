/**
 * Core (2026.9.4, buildFailureWarning) adds "⚠️ <Tool> blocked|failed" as an
 * error payload whenever a run ends with no user-facing reply and an
 * unresolved tool error. A heartbeat that correctly answers NO_REPLY counts
 * as no reply, and the heartbeat runner delivers error payloads unfiltered,
 * so a stale error (even a call to a tool that does not exist) reaches the
 * owner as a DM. Heartbeat sends skip reply_payload_sending and give
 * message_sending neither the run id nor isError, so the warning is
 * recognised by its session and its text.
 */

// Delivery follows agent_end; the session stays marked this long after.
const HEARTBEAT_DELIVERY_WINDOW_MS = 60_000;

// Session key -> when its mark expires (Infinity while a heartbeat runs).
const heartbeatSessions = new Map<string, number>();

// Core's default (non-verbose) shapes: "⚠️ Grep blocked",
// "⚠️ Exec failed (exit 1)", "⚠️ Process failed (signal …). Use /verbose …",
// and, with /verbose full, "⚠️ Read: notes.md failed: …". The label is a
// title-cased tool name, which keeps prose like "⚠️ Your deploy failed" out.
const TOOL_FAILURE_WARNING_RE =
  /^⚠️ [A-Z][\w-]*(?: [A-Z][\w-]*)*(?:: [^\n]+?)? (?:blocked|failed)(?:$|[ :(.])/u;

export function noteAgentTurnStart(
  sessionKey: string | undefined,
  isHeartbeat: boolean,
  now = Date.now()
): void {
  for (const [key, expiresAt] of heartbeatSessions) {
    if (expiresAt <= now) heartbeatSessions.delete(key);
  }
  if (!sessionKey) return;
  if (isHeartbeat) {
    heartbeatSessions.set(sessionKey, Infinity);
  } else {
    heartbeatSessions.delete(sessionKey);
  }
}

export function noteAgentTurnEnd(
  sessionKey: string | undefined,
  now = Date.now()
): void {
  if (sessionKey && heartbeatSessions.has(sessionKey)) {
    heartbeatSessions.set(sessionKey, now + HEARTBEAT_DELIVERY_WINDOW_MS);
  }
}

/** Whether a send is core's tool-failure warning for a heartbeat run. */
export function isHeartbeatToolFailureWarning(
  sessionKey: string | undefined,
  content: string | undefined,
  now = Date.now()
): boolean {
  if (!sessionKey || !content) return false;
  const expiresAt = heartbeatSessions.get(sessionKey);
  if (expiresAt === undefined || expiresAt <= now) return false;
  return TOOL_FAILURE_WARNING_RE.test(content.trim());
}

export function resetHeartbeatToolWarningStateForTest(): void {
  heartbeatSessions.clear();
}
