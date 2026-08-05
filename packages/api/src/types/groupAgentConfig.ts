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
 * is a relocation, not a migration. The writer today is the agent itself
 * (via the tlon CLI); the client only reads.
 */

export const GROUP_AGENT_CONFIG_ENTRY_TYPE = 'tlon-group-agent-config';

/**
 * Only `type` and `version` are strict — they identify the entry. Every other
 * field degrades to a default rather than failing the parse.
 *
 * The writer is a model following prose instructions, and rejecting the whole
 * entry over one malformed field is catastrophic rather than safe: the agent
 * stops being recognized, its interactive cards vanish, the raw JSON shows up
 * as the group's description, and any client state gated on the config (the
 * first-run chrome lock) stays stuck. It also made the client disagree with
 * the bot, which treats the same description as configured and moves on. A
 * missing `purpose` costs a line of display text; a rejected entry costs the
 * group.
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
 * True once the group's agent config records a job — the setup's final
 * artifact, and so the client's definition of "this group's onboarding is
 * finished". Chrome hidden during a guided setup unhides when this flips
 * true; the openclaw plugin gates its closing invite card on the same
 * signal.
 */
export function groupHasConfiguredJob(
  description: string | null | undefined
): boolean {
  return (parseGroupAgentConfig(description)?.jobs.length ?? 0) > 0;
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

/**
 * What to show wherever a group's description is displayed.
 *
 * Agent groups keep their machine-readable config in `meta.description` (the
 * stopgap until it has a home of its own), so the raw field is a JSON blob
 * that must never reach a header or a preview card. The config carries the
 * prose equivalent — its `purpose` — so show that instead of nothing.
 *
 * FIXME(group-description-hijack): while the hijack is in effect, the app
 * hides group description display entirely — every former display site is
 * tagged with this marker (grep it), and invite previews omit it too, so
 * this helper currently has no callers outside tests. It stays because it is
 * the only safe accessor: when the config moves to a first-class field and
 * display comes back, every restored site must go through here, never the
 * raw field.
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
 * FIXME(group-description-hijack): the group editor no longer exposes the
 * description at all, so no UI path produces such an edit today — this
 * survives as a guard for any caller that still writes group meta with a
 * prose description. Saving prose raw would overwrite the machine-readable
 * entry and un-configure the group's agent; instead the edited text becomes
 * the config's `purpose` and everything else survives. Descriptions without
 * a config pass through unchanged.
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
