/**
 * Wire types for the %steward agent's lens module (per-run bot introspection).
 * See desk/sur/steward/lens.hoon and docs/backend/desk/app/steward.md.
 */

export interface LensRunEntry {
  /** @p of the bot ship the run belongs to */
  bot: string;
  /** lensId stamped into the channel post pointer blob */
  id: string;
  /** whether a %run-final has been received for this id */
  complete: boolean;
  /** @da string of when the latest record arrived on the owner ship */
  received: string;
  /** the run record, relayed as structured JSON with an inner schemaVersion */
  payload: unknown;
}

/**
 * The lens update (steward-lens-update-1), a tagged union:
 *   - `entry`: a single run, facted on /v1/lens and returned by the /run scry
 *   - `recent`: a batch, returned by the /recent and /since scries
 *   - `page`: one page of a cron job's runs, returned by the /cron scries
 *   - `retry-requested`: emitted on the bot ship for its gateway; the
 *     owner-side client ignores it
 */
export type LensUpdate =
  | { entry: LensRunEntry }
  | { recent: LensRunEntry[] }
  | { page: { total: number; entries: LensRunEntry[] } }
  | { 'retry-requested': { id: string; requester: string } };

/**
 * Scry response for /x/v1/lens/recent[/<count>] and /x/v1/lens/since/<da>:
 * the %recent update variant, carrying a batch of entries.
 */
export type LensRecentScry = { recent: LensRunEntry[] };

/**
 * Scry response for /x/v1/lens/cron/<bot>/<job>/<count>[/<da>]: the newest
 * runs of one cron job (older than <da> when given), newest first, and how
 * many runs of it the owner ship holds.
 */
export type LensCronPageScry = {
  page: { total: number; entries: LensRunEntry[] };
};
