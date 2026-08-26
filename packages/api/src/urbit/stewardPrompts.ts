/**
 * Wire types for the %steward agent's prompts module (ship-durable,
 * owner-editable gateway system prompts). See desk/sur/steward/prompts.hoon
 * and docs/steward.md.
 */

export interface StewardPromptEntry {
  /** full prompt file contents */
  text: string;
  /** @da string of when this text was stored on the ship */
  updated: string;
}

/** prompt file name (e.g. "SOUL.md") -> stored prompt */
export type StewardPromptsMap = Record<string, StewardPromptEntry>;

/**
 * The prompts update (steward-prompts-update-1), a tagged union:
 *   - `prompts`: a bot's full prompt set — the scry result, and facted on
 *     /v1/prompts whenever a set changes
 *   - `set`: a single stored edit, emitted on the bot ship for its gateway;
 *     the owner-side client ignores it
 */
export type StewardPromptsUpdate =
  | { prompts: { bot: string; prompts: StewardPromptsMap } }
  | { set: { name: string; prompt: StewardPromptEntry } };

/** Scry response for /x/v1/prompts/<bot>: the %prompts update variant. */
export type StewardPromptsScry = {
  prompts: { bot: string; prompts: StewardPromptsMap };
};

/** Poke payload for %steward-prompts-action-1 %set (an owner edit). */
export interface StewardPromptsSetAction {
  set: {
    bot: string;
    name: string;
    text: string;
  };
}
