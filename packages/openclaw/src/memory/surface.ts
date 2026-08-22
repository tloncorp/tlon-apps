/**
 * Parse Tlon session keys into the surface (DM or group channel) they serve.
 *
 * Session keys observed from OpenClaw routing:
 *   agent:<agent>:tlon:direct:~ship
 *   agent:<agent>:tlon:channel:chat/~zod/general
 *
 * Threads append `:thread:<id>` and the active-memory recall sub-agent
 * appends `:active-memory:<hash>`. Both suffixes are recognized and stripped;
 * a thread's surface is its parent channel or DM (memory inherits downward).
 */

export type TlonSurface =
  | { kind: 'dm'; ship: string; threadId?: string }
  | { kind: 'channel'; nest: string; threadId?: string };

const SESSION_KEY_RE = /^agent:[^:]+:tlon:(direct|channel):(.+)$/;
const SHIP_RE = /^~[a-z-]+$/;
const NEST_RE = /^(chat|heap|diary)\/~[a-z-]+\/[a-z0-9.-]+$/;

/**
 * Strip a trailing `:active-memory:<hash>` suffix, if present. The recall
 * sub-agent's session key is its parent's key plus this suffix, so the
 * stripped key identifies the surface being served.
 */
export function stripActiveMemorySuffix(sessionKey: string): string {
  const idx = sessionKey.indexOf(':active-memory:');
  return idx > 0 ? sessionKey.slice(0, idx) : sessionKey;
}

/** Strip a trailing `:thread:<id>` suffix, if present. */
export function stripThreadSuffix(sessionKey: string): string {
  const idx = sessionKey.indexOf(':thread:');
  return idx > 0 ? sessionKey.slice(0, idx) : sessionKey;
}

/**
 * Parse a session key into its Tlon surface, or null when the key does not
 * belong to the Tlon channel (webchat, cron, subagents, other channels).
 */
export function parseTlonSurface(sessionKey: string): TlonSurface | null {
  const trimmed = sessionKey?.trim();
  if (!trimmed) {
    return null;
  }
  const base = stripActiveMemorySuffix(trimmed);
  const threadIdx = base.indexOf(':thread:');
  const threadId =
    threadIdx > 0 ? base.slice(threadIdx + ':thread:'.length) : undefined;
  const surfaceKey = threadIdx > 0 ? base.slice(0, threadIdx) : base;

  const match = SESSION_KEY_RE.exec(surfaceKey);
  if (!match) {
    return null;
  }
  const [, kind, rest] = match;
  if (kind === 'direct') {
    if (!SHIP_RE.test(rest)) {
      return null;
    }
    return { kind: 'dm', ship: rest, ...(threadId ? { threadId } : {}) };
  }
  if (!NEST_RE.test(rest)) {
    return null;
  }
  return { kind: 'channel', nest: rest, ...(threadId ? { threadId } : {}) };
}
