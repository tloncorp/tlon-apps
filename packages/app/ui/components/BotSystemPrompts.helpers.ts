import type * as api from '@tloncorp/api';

/**
 * What our ship's prompts-module probe has determined so far. `unresolved`
 * covers both a probe in flight and one still burning its retry budget: a
 * 404 there means either the ship has no module or %steward is restarting,
 * and only an exhausted probe distinguishes them.
 */
export type PromptsModuleState = 'present' | 'absent' | 'unresolved';

export type BotOwnershipInputs = {
  /** The bot's mirrored prompt set; undefined when never resolved. */
  prompts: api.BotSystemPrompt[] | null | undefined;
  /**
   * True while the per-bot mirror scry has produced nothing trustworthy:
   * still loading, refetching, errored, or answered before this mount.
   */
  mirrorUnresolved: boolean;
  module: PromptsModuleState;
};

/**
 * Decide whether a ship is a bot we own, and whether that verdict is
 * settled enough to gate a destructive action (Block) on.
 *
 * The subtlety is that the per-bot mirror scry 404s — and so resolves to a
 * successful `null` — in two very different situations: an ordinary ship
 * with no mirror, and our own %steward restarting. Taken alone it would
 * report an owned bot as unowned for the length of a restart, which is
 * exactly when Block must stay hidden. So a null only becomes an
 * authoritative "not owned" once the module probe has confirmed the module
 * is there (or has exhausted its retries and found it genuinely absent, in
 * which case no mirror can exist and every ship is unowned).
 */
export function resolveBotOwnership(inputs: BotOwnershipInputs): {
  isOwnedBot: boolean;
  isPending: boolean;
} {
  const isOwnedBot = Boolean(inputs.prompts?.length);
  if (inputs.module === 'absent') {
    // The ship serves no prompt mirrors at all, so the mirror scry has
    // nothing left to decide. Keeping Block hidden on every profile until
    // such a ship upgrades would be worse than the ambiguity this resolves.
    return { isOwnedBot, isPending: false };
  }
  return {
    isOwnedBot,
    isPending: inputs.module === 'unresolved' || inputs.mirrorUnresolved,
  };
}
