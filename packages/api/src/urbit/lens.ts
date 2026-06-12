/**
 * Wire types for the %context-lens agent (per-run bot introspection).
 * See desk/sur/context-lens.hoon and docs/context-lens.md.
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
  /** opaque serialized-JSON run record with an inner schemaVersion */
  payload: string;
}

export type LensUpdate = { run: LensRunEntry } | { runs: LensRunEntry[] };
