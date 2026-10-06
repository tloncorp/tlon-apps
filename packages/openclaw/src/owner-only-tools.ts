/**
 * Owner-only tool policy shared by the before_tool_call gate (index.ts) and
 * the ContextLens owner-tool advertisement (monitor/index.ts).
 *
 * The block reason is the ONLY text the model receives for a vetoed call:
 * OpenClaw core (2026.5.28 through 2026.8.2) returns `blockReason` verbatim as
 * a normal, non-error tool result with no framing. Observers (after_tool_call
 * `event.error`, the owner "silent failure" notice) keep only its first line,
 * capped at 400 / 200 chars — keep it one line and within the cap below.
 */
import type { SenderRole } from './session-roles.js';

export const OWNER_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'tlon',
  'cron',
  'read',
]);

export const OWNER_ONLY_TOOL_PREFIXES = ['mcp_'] as const;

/** Longest first line the TLON-6361 owner notice shows untruncated. */
export const OWNER_ONLY_BLOCK_REASON_MAX_CHARS = 200;

export function formatOwnerOnlyToolBlockReason(toolName: string): string {
  // Use the tool family so arbitrarily long upstream names fit the notice cap.
  const prefix = OWNER_ONLY_TOOL_PREFIXES.find((prefix) =>
    toolName.startsWith(prefix)
  );
  const label = prefix ? `${prefix}*` : toolName;
  return (
    `Blocked by policy: the ${label} tool is owner-only and this requester is not the owner. ` +
    'Tell them you cannot do this for them; do not retry for them, and do not blame a reload, outage, or missing tool.'
  );
}

export type OwnerOnlyToolDecision = {
  /** The tool matches an owner-only name or prefix. */
  ownerOnly: boolean;
  /** Veto the call: owner-only tool and the session role is a non-owner user. */
  blocked: boolean;
  /** Model-facing reason; present iff `blocked`. */
  reason?: string;
};

export function resolveOwnerOnlyToolBlock(
  toolName: string,
  role: SenderRole | undefined
): OwnerOnlyToolDecision {
  const ownerOnly =
    OWNER_ONLY_TOOLS.has(toolName) ||
    OWNER_ONLY_TOOL_PREFIXES.some((prefix) => toolName.startsWith(prefix));
  // Only an explicit non-owner ('user') role blocks. Owner sessions and
  // internal sessions (heartbeat, cron, subagents — no stored role) pass.
  const blocked = ownerOnly && role === 'user';
  return blocked
    ? { ownerOnly, blocked, reason: formatOwnerOnlyToolBlockReason(toolName) }
    : { ownerOnly, blocked };
}
