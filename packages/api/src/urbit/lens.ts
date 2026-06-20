/**
 * Wire types for the %steward agent's lens module (per-run bot introspection).
 * See desk/sur/steward.hoon and docs/steward.md.
 *
 * The agent stores run records keyed by [bot id]; clients subscribe to
 * /v1/lens for live updates and scry /x/v1/lens/* for backfill.
 */

export interface LensRunEntry {
  /** @p of the bot ship the run belongs to */
  bot: string;
  /** lensId stamped into the channel post pointer blob */
  id: string;
  /** whether a final (final=true) record has been received for this id */
  complete: boolean;
  /** @da string of when the latest record arrived on the owner ship */
  received: string;
  /** opaque serialized-JSON run record with an inner schemaVersion */
  payload: string;
}

/**
 * %steward lens-module update variants. Subscribers on /v1/lens see
 * `%entry` (a stored run record) and `%retry-requested` (a signal for the
 * local gateway). The `%recent` variant only appears in scry responses
 * for the /recent and /since paths — it carries a batch of entries.
 */
export type LensModuleUpdate =
  | { entry: LensRunEntry }
  | { 'retry-requested': { id: string; requester: string } }
  | { recent: LensRunEntry[] };

export type StewardUpdate =
  | { lens: LensModuleUpdate }
  | { gateway: unknown };

/**
 * Lens-module actions poked into %steward. The wire shape always nests
 * under the top-level { lens: ... } module tag.
 *
 *   { entry: { id, payload, final } }   — gateway pushes a run milestone
 *   { retry: { bot, id } }              — owner asks to re-dispatch
 *   { configure: { 'max-runs-per-bot' } } — set the retention cap
 */
export type LensModuleAction =
  | { entry: { id: string; payload: string; final: boolean } }
  | { retry: { bot: string; id: string } }
  | { configure: { 'max-runs-per-bot': number } };

/**
 * Scry response for /x/v1/lens/recent[/<count>] and /x/v1/lens/since/<da>:
 * a steward-update-1 cage carrying a %recent update with the entry batch.
 */
export type LensRecentScry = { lens: { recent: LensRunEntry[] } };
