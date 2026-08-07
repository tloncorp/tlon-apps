import { z } from 'zod';

import { preSig } from '../lib/urbit';

/**
 * Group agent configuration.
 *
 * Describes what an agent should do in a group: a user-visible purpose,
 * standing instructions, and a set of declarative recurring jobs. The durable
 * home for this entry is a first-class custom-payload (`blob`) field on the
 * group record (mirroring the post blob); until that field ships, the entry
 * is stored as a single-element JSON entry array in the group's
 * `meta.description` — see `parseGroupAgentConfig`. The array-of-typed-entries
 * wire shape matches the post blob convention so the move to the real field
 * is a relocation, not a migration. The writer is the trusted OpenClaw
 * onboarding coordinator (via a direct argv-based Tlon invocation); the
 * client only reads.
 */

export const GROUP_AGENT_CONFIG_ENTRY_TYPE = 'tlon-group-agent-config';

/**
 * Only `type` and `version` are strict — they identify the entry. Every other
 * field degrades to a default rather than failing the parse. This tolerance is
 * retained for configs produced by older model-driven onboarding releases.
 */
const GroupAgentConfigEntrySchema = z.object({
  type: z.literal(GROUP_AGENT_CONFIG_ENTRY_TYPE),
  version: z.literal(1),
  /** template provenance */
  templateId: z.string().optional().catch(undefined),
  /** one sentence, user-visible */
  purpose: z.string().max(500).catch(''),
  /** agent context for all activity in this group */
  instructions: z.string().max(8000).catch(''),
  /** ships expected to act on this config */
  agents: z.array(z.string()).catch([]),
  /**
   * Deliberately unvalidated: the writer is a model following instructions,
   * and the client reads nothing from inside a job except its presence —
   * so a job with one misshapen field must not fail the whole entry, which
   * would un-recognize the agent, hide its UI, and leak the raw JSON as the
   * group's description. The intended shape (authored by the openclaw
   * templates) is `{id, title, schedule: {kind:'cron', expr, tz}, prompt,
   * outputNest, announceNest?, checkIn?, enabled}`.
   */
  jobs: z.array(z.unknown()).catch([]),
  /**
   * Deterministic first-run coordinator state. Older/model-authored configs
   * omit it; callers retain the legacy jobs-present fallback for them.
   */
  onboarding: z
    .object({
      state: z.enum([
        'awaiting-topics',
        'awaiting-timezone',
        'creating-cron',
        'awaiting-notebook',
        'researching',
        'writing-note',
        'complete',
        'failed',
      ]),
      topics: z.string().max(1000),
      timezone: z.string().max(100).optional(),
      cronJobId: z.string().max(500).optional(),
      notebookNest: z.string().max(500).optional(),
      noteBaseline: z.string().max(500).nullable().optional(),
      noteId: z.string().max(500).optional(),
      lastError: z.string().max(1000).optional(),
    })
    .optional()
    .catch(undefined),
  updatedAt: z.number().catch(0),
});

export type GroupAgentConfigEntry = z.infer<typeof GroupAgentConfigEntrySchema>;

/**
 * Tolerantly extract a config entry from a group description. Returns
 * undefined for plain-text descriptions, malformed JSON, or entries that fail
 * validation — callers must treat those as "no config".
 */
export function parseGroupAgentConfig(
  description: string | null | undefined
): GroupAgentConfigEntry | undefined {
  if (!description) {
    return undefined;
  }
  const trimmed = description.trim();
  if (!trimmed.startsWith('[')) {
    return undefined;
  }
  let entries: unknown;
  try {
    entries = JSON.parse(trimmed);
  } catch {
    return undefined;
  }
  if (!Array.isArray(entries)) {
    return undefined;
  }
  for (const entry of entries) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      (entry as { type?: unknown }).type === GROUP_AGENT_CONFIG_ENTRY_TYPE
    ) {
      const parsed = GroupAgentConfigEntrySchema.safeParse(entry);
      if (parsed.success) {
        return parsed.data;
      }
      return undefined;
    }
  }
  return undefined;
}

/**
 * True once the group's agent config records a job. In deterministic
 * onboarding this means the scheduler has been verified and the client may
 * create the notebook; completion is tracked separately below.
 */
export function groupHasConfiguredJob(
  description: string | null | undefined
): boolean {
  return (parseGroupAgentConfig(description)?.jobs.length ?? 0) > 0;
}

/**
 * The guided first-run flow is complete only once its coordinator has
 * verified the notebook write. Legacy configs predate coordinator state, so
 * their existing jobs-present signal remains the compatibility fallback.
 */
export function groupAgentOnboardingIsComplete(
  description: string | null | undefined
): boolean {
  const config = parseGroupAgentConfig(description);
  if (!config) {
    return false;
  }
  if (config.onboarding) {
    return config.onboarding.state === 'complete';
  }
  return config.jobs.length > 0;
}

/**
 * Whether a post's author is the current user's own agent.
 *
 * Two accepted signals, because the config isn't always written yet: the
 * client's own first-hand record of the agent's ship (from the hosting
 * config, or from having seated the agent itself — available before the
 * group is configured, which is what the setup card needs), and a configured
 * group naming its agents outright. Deliberately no ship-name heuristics
 * (a moon-of-my-node check used to live here): identity comes from what the
 * client knows first-hand, never from the shape of an @p. And deliberately
 * not `post.isBot` — that comes from the author's contact profile and is
 * false for agents the user hasn't got a bot-flagged contact for.
 */
export function isOwnAgentShip({
  authorId,
  currentUserId,
  groupDescription,
  knownAgentShip,
}: {
  authorId: string | null | undefined;
  currentUserId: string | null | undefined;
  groupDescription?: string | null;
  /**
   * The agent ship this client knows first-hand: recorded when it created
   * the group with the agent seated, or resolved from the hosting config for
   * the provisioned home group. The one signal here the agent cannot write:
   * the config's `agents` list is the agent's own claim about itself, so a
   * config it writes badly would otherwise stop its cards rendering.
   */
  knownAgentShip?: string | null;
}): boolean {
  if (!authorId || !currentUserId) {
    return false;
  }
  const author = preSig(authorId).toLowerCase();
  if (author === preSig(currentUserId).toLowerCase()) {
    return false;
  }
  if (knownAgentShip && preSig(knownAgentShip).toLowerCase() === author) {
    return true;
  }
  const config = parseGroupAgentConfig(groupDescription);
  return !!config?.agents.some(
    (agent) => preSig(agent).toLowerCase() === author
  );
}

/**
 * Whether interactive agent UI (A2UI cards) may render for this post.
 *
 * A group is a shared space, so an arbitrary member's bot must not be able to
 * render buttons for everyone. Restricted to groups the current user hosts,
 * and to posts authored by their own agent. DMs are gated separately by the
 * caller.
 */
export function canRenderAgentUiInGroup({
  authorId,
  currentUserId,
  groupId,
  groupDescription,
  knownAgentShip,
}: {
  authorId: string | null | undefined;
  currentUserId: string | null | undefined;
  groupId: string | null | undefined;
  groupDescription?: string | null;
  knownAgentShip?: string | null;
}): boolean {
  if (!groupId || !currentUserId) {
    return false;
  }
  const host = groupId.split('/')[0];
  if (
    !host ||
    preSig(host).toLowerCase() !== preSig(currentUserId).toLowerCase()
  ) {
    return false;
  }
  return isOwnAgentShip({
    authorId,
    currentUserId,
    groupDescription,
    knownAgentShip,
  });
}

// FIXME(group-description-hijack): while the hijack is in effect, the app
// hides group description display entirely and the editor hides the field
// for groups — every affected site is tagged with this marker (grep it).
// When the config moves to a first-class field and display comes back,
// restored sites must read the config's `purpose` via
// `parseGroupAgentConfig`, never the raw field.
