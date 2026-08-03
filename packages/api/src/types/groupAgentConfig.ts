import { z } from 'zod';

import { isMoonOf, preSig } from '../lib/urbit';

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
 * is a relocation, not a migration. The writer today is the agent itself
 * (via the tlon CLI); the client only reads.
 */

const GroupJobScheduleSchema = z.union([
  z.object({
    kind: z.literal('cron'),
    expr: z.string().min(1),
    tz: z.string().min(1),
  }),
  z.object({
    kind: z.literal('interval'),
    everyMs: z.number().int().positive(),
  }),
]);

const GroupJobSpecSchema = z.object({
  /** stable slug, unique within the group */
  id: z.string().min(1).max(64),
  /** e.g. "Morning digest" */
  title: z.string().min(1).max(200),
  schedule: GroupJobScheduleSchema,
  /** full instruction the agent runs */
  prompt: z.string().min(1).max(4000),
  /**
   * Where output lands, e.g. "notes/~ship/slug" or "chat/~ship/slug".
   * Empty until the job's first run creates the output channel — the setup
   * directive requires writing it that way, so an empty string must parse.
   */
  outputNest: z.string(),
  /** optional chat ping when output lands elsewhere */
  announceNest: z.string().min(1).optional(),
  checkIn: z.object({ everyRuns: z.number().int().positive() }).optional(),
  enabled: z.boolean(),
});

export const GROUP_AGENT_CONFIG_ENTRY_TYPE = 'tlon-group-agent-config';

const GroupAgentConfigEntrySchema = z.object({
  type: z.literal(GROUP_AGENT_CONFIG_ENTRY_TYPE),
  version: z.literal(1),
  /** template provenance */
  templateId: z.string().optional(),
  /** one sentence, user-visible */
  purpose: z.string().max(500),
  /** agent context for all activity in this group */
  instructions: z.string().max(8000),
  /** ships expected to act on this config */
  agents: z.array(z.string()),
  jobs: z.array(GroupJobSpecSchema),
  updatedAt: z.number(),
});

export type GroupAgentConfigEntry = z.infer<typeof GroupAgentConfigEntrySchema>;

/**
 * Tolerantly extract a config entry from a group description. Returns
 * undefined for plain-text descriptions, malformed JSON, or entries that fail
 * validation — callers must treat those as "no config".
 */
function parseGroupAgentConfig(
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
 * Whether a post's author is the current user's own agent.
 *
 * Two accepted signals, because the authoritative one isn't always available
 * yet: a hosted agent is a moon of the account's node (true even before the
 * group is configured, which is what the setup card needs), and a configured
 * group names its agents outright. Deliberately not using `post.isBot` — that
 * comes from the author's contact profile and is false for agents the user
 * hasn't got a bot-flagged contact for.
 */
export function isOwnAgentShip({
  authorId,
  currentUserId,
  groupDescription,
}: {
  authorId: string | null | undefined;
  currentUserId: string | null | undefined;
  groupDescription?: string | null;
}): boolean {
  if (!authorId || !currentUserId) {
    return false;
  }
  const author = preSig(authorId).toLowerCase();
  if (author === preSig(currentUserId).toLowerCase()) {
    return false;
  }
  if (isMoonOf(authorId, currentUserId)) {
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
}: {
  authorId: string | null | undefined;
  currentUserId: string | null | undefined;
  groupId: string | null | undefined;
  groupDescription?: string | null;
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
  return isOwnAgentShip({ authorId, currentUserId, groupDescription });
}

/**
 * What to show wherever a group's description is displayed.
 *
 * Agent groups keep their machine-readable config in `meta.description` (the
 * stopgap until it has a home of its own), so the raw field is a JSON blob
 * that must never reach a header or a preview card. The config carries the
 * prose equivalent — its `purpose` — so show that instead of nothing.
 */
export function groupDisplayDescription(description?: string | null): string {
  const config = parseGroupAgentConfig(description);
  if (config) {
    return config.purpose.trim();
  }
  return description ?? '';
}

/**
 * Fold a human-edited description back into a config-bearing one.
 *
 * The group editor shows `groupDisplayDescription` — the config's purpose —
 * so what the user edits is prose. Saving that prose raw would overwrite the
 * machine-readable entry and un-configure the group's agent; instead the
 * edited text becomes the config's `purpose` and everything else survives.
 * Descriptions without a config pass through unchanged.
 */
export function mergeGroupDescriptionEdit(
  currentDescription: string | null | undefined,
  editedDescription: string
): string {
  const config = parseGroupAgentConfig(currentDescription);
  if (!config) {
    return editedDescription;
  }
  return JSON.stringify([{ ...config, purpose: editedDescription.trim() }]);
}
