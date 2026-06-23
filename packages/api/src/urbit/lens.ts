/**
 * Wire types for the %steward agent's lens module (per-run bot introspection).
 * See desk/sur/steward/lens.hoon and docs/steward.md.
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
 *   - `retry-requested`: emitted on the bot ship for its gateway; the
 *     owner-side client ignores it
 */
export type LensUpdate =
  | { entry: LensRunEntry }
  | { recent: LensRunEntry[] }
  | { 'retry-requested': { id: string; requester: string } };
