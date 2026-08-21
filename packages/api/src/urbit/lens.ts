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

/** Stable, provider-neutral activity contract shared by gateways and clients. */
export type ContextLensActivityKind =
  | 'lifecycle'
  | 'commentary'
  | 'plan'
  | 'item'
  | 'tool'
  | 'approval'
  | 'request_input'
  | 'command'
  | 'patch'
  | 'compaction'
  | 'error';

export type ContextLensActivityStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'error'
  | 'blocked'
  | 'cancelled'
  | 'unknown';

export type ContextLensActivityPlanStep = {
  id: string;
  title: string;
  status: ContextLensActivityStatus;
};

export type ContextLensActivityPlan = {
  title?: string;
  explanation?: string;
  steps: ContextLensActivityPlanStep[];
  updatedAt: number;
};

export type ContextLensActivityEvent = {
  schemaVersion: 1;
  runId: string;
  sequence: number;
  occurredAt: number;
  kind: ContextLensActivityKind;
  phase: string;
  retention: 'snapshot' | 'ephemeral';
  itemId?: string;
  title?: string;
  status?: ContextLensActivityStatus;
  progressText?: string;
  name?: string;
  toolCallId?: string;
  source?: string;
  plan?: ContextLensActivityPlan;
  counts?: {
    added?: number;
    modified?: number;
    deleted?: number;
  };
};

export type ContextLensActivityItem = {
  id: string;
  kind: Exclude<ContextLensActivityKind, 'lifecycle' | 'plan'>;
  title: string;
  status: ContextLensActivityStatus;
  /** Plan step that was active when this item first appeared, when available. */
  planStepId?: string;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  progressText?: string;
  name?: string;
  toolCallId?: string;
  source?: string;
  counts?: ContextLensActivityEvent['counts'];
};

export type ContextLensActivity = {
  schemaVersion: 1;
  eventCount: number;
  lastEventAt: number | null;
  truncated: boolean;
  plan: ContextLensActivityPlan | null;
  items: ContextLensActivityItem[];
};

/**
 * Activity that is meaningful enough to earn a durable task card in chat.
 *
 * This is deliberately structural. In particular, generic provider items,
 * reasoning labels, lifecycle events, compaction, elapsed time, and final
 * reply prose do not make a run card-eligible.
 */
export function hasContextLensActivityCardContent(
  activity?: ContextLensActivity | null
): boolean {
  return (activity?.items ?? []).some(
    (item) =>
      item.kind === 'commentary' ||
      (item.kind === 'tool' && item.name !== 'update_plan') ||
      item.kind === 'approval' ||
      item.kind === 'request_input' ||
      item.kind === 'command' ||
      item.kind === 'patch' ||
      item.kind === 'error'
  );
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

/**
 * Scry response for /x/v1/lens/recent[/<count>] and /x/v1/lens/since/<da>:
 * the %recent update variant, carrying a batch of entries.
 */
export type LensRecentScry = { recent: LensRunEntry[] };
