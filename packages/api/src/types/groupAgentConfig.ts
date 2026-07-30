import { z } from 'zod';

import { isMoonOf, preSig } from '../lib/urbit.js';

/**
 * Group agent configuration.
 *
 * Describes what an agent should do in a group: a user-visible purpose,
 * standing instructions, and a set of declarative recurring jobs. The durable
 * home for this entry is a first-class custom-payload (`blob`) field on the
 * group record (mirroring the post blob); until that field ships, the entry
 * is stored as a single-element JSON entry array in the group's
 * `meta.description` — see `encodeGroupAgentConfig` / `parseGroupAgentConfig`.
 * The array-of-typed-entries wire shape matches the post blob convention so
 * the move to the real field is a relocation, not a migration.
 */

export const GroupJobScheduleSchema = z.union([
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

export type GroupJobSchedule = z.infer<typeof GroupJobScheduleSchema>;

export const GroupJobSpecSchema = z.object({
  /** stable slug, unique within the group */
  id: z.string().min(1).max(64),
  /** e.g. "Morning digest" */
  title: z.string().min(1).max(200),
  schedule: GroupJobScheduleSchema,
  /** full instruction the agent runs */
  prompt: z.string().min(1).max(4000),
  /** where output lands, e.g. "diary/~ship/slug" or "chat/~ship/slug" */
  outputNest: z.string().min(1),
  /** optional chat ping when output lands elsewhere */
  announceNest: z.string().min(1).optional(),
  checkIn: z.object({ everyRuns: z.number().int().positive() }).optional(),
  enabled: z.boolean(),
});

export type GroupJobSpec = z.infer<typeof GroupJobSpecSchema>;

export const GROUP_AGENT_CONFIG_ENTRY_TYPE = 'tlon-group-agent-config';

export const GroupAgentConfigEntrySchema = z.object({
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

/** Encoded entry budget, matching the A2UI blob cap. */
export const GROUP_AGENT_CONFIG_MAX_BYTES = 32 * 1024;

/**
 * Encode a config entry into the group description stopgap format: a JSON
 * array of typed entries. Throws on invalid or oversized entries.
 */
export function encodeGroupAgentConfig(entry: GroupAgentConfigEntry): string {
  const parsed = GroupAgentConfigEntrySchema.safeParse(entry);
  if (!parsed.success) {
    throw new Error(
      `Invalid GroupAgentConfigEntry: ${parsed.error.issues[0]?.message ?? 'unknown'}`
    );
  }
  const encoded = JSON.stringify([parsed.data]);
  if (encoded.length > GROUP_AGENT_CONFIG_MAX_BYTES) {
    throw new Error('GroupAgentConfigEntry exceeds size budget');
  }
  return encoded;
}

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
 * True when a group description holds an encoded config entry array rather
 * than human-readable text. Used to keep raw JSON out of description UI.
 */
export function descriptionIsGroupAgentConfig(
  description: string | null | undefined
): boolean {
  return parseGroupAgentConfig(description) !== undefined;
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
