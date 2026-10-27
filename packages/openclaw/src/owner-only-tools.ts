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
import { CRON_TOOL_NAMES } from './cron-tool-args-guard.js';
import type { SenderRole } from './session-roles.js';

/**
 * Tools that hand work to another run: a spawned session, the Codex native
 * subagent (`spawn_agent`; the native relay normalizes `agent` to it), or the
 * system agent (`openclaw`) has no stored role and would pass this gate, and a
 * sent message drives another session's run. The session listing, history,
 * search, status, wait, and yield tools stay open.
 */
export const DELEGATION_TOOL_NAMES = [
  'sessions_spawn',
  'sessions_send',
  'spawn_agent',
  'openclaw',
] as const;

export const OWNER_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'tlon',
  // The scheduler under every name core gives it, so a rename cannot open it
  // to non-owners.
  ...CRON_TOOL_NAMES,
  'read',
  // Workspace writers: the workspace holds the bot's skills, memory, and
  // prompts. Codex native file edits reach this gate as `apply_patch`.
  'write',
  'edit',
  'apply_patch',
  // Creates, patches, and applies workspace skills.
  'skill_workshop',
  // Shell and process control: a shell can read and write every file the
  // gates above protect. Core normalizes `bash` to `exec` and the Codex native
  // relay normalizes `exec_command` to `exec`, so both arrive as `exec`; native
  // `shell`/`shell_command` arrive unchanged. The Codex harness's
  // sandbox_exec/sandbox_process/node_exec/gateway_exec/gateway_process are
  // projections over the hook-wrapped exec/process tools. The sandbox and node
  // projections are spreads that keep the wrapper marker, so they are not
  // re-wrapped and reach this gate once, as exec/process; they are not listed.
  // The gateway pair stays listed in case its projection reaches the gate
  // under its own name.
  'exec',
  'process',
  'shell',
  'shell_command',
  'gateway_exec',
  'gateway_process',
  // Input to Control UI terminals.
  'terminal',
  'tlon_agent_choice',
  'tlon_agent_task_plan',
  'tlon_agent_service_setup',
  'set_timezone',
  ...DELEGATION_TOOL_NAMES,
]);

/** Longest first line the TLON-6361 owner notice shows untruncated. */
export const OWNER_ONLY_BLOCK_REASON_MAX_CHARS = 200;

export function formatOwnerOnlyToolBlockReason(toolName: string): string {
  return (
    `Blocked by policy: the ${toolName} tool is owner-only; they're not the owner. ` +
    'Tell them you cannot do this for them; do not retry for them; do not blame a reload, outage, or missing tool.'
  );
}

export type OwnerOnlyToolDecision = {
  /** The tool is in the owner-only set. */
  ownerOnly: boolean;
  /** Veto the call: owner-only tool and the session role is a non-owner user. */
  blocked: boolean;
  /** Model-facing reason; present iff `blocked`. */
  reason?: string;
};

export function resolveOwnerOnlyToolBlock(
  toolName: string,
  role: SenderRole | undefined,
  params?: Record<string, unknown>
): OwnerOnlyToolDecision {
  // The hosted browser shares the owner's sessions and saved accounts.
  // Protect all browser operations, including reading an authenticated page.
  const browserTool =
    toolName === 'mcp__call' &&
    typeof params?.name === 'string' &&
    params.name.startsWith('browser_');
  const ownerOnly = OWNER_ONLY_TOOLS.has(toolName) || browserTool;
  // Only an explicit non-owner ('user') role blocks. Owner sessions and
  // internal sessions (heartbeat, cron, subagents — no stored role) pass;
  // a passing `tlon` call still runs as the bot unless the turn is
  // owner-directed (turn-identity.ts).
  const blocked = ownerOnly && role === 'user';
  return blocked
    ? {
        ownerOnly,
        blocked,
        reason: formatOwnerOnlyToolBlockReason(
          browserTool ? 'browser' : toolName
        ),
      }
    : { ownerOnly, blocked };
}
