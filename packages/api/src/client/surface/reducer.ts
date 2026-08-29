import { createDevLogger } from '../../lib/logger';
import { parsePostBlob } from '../content-helpers';
import { JsonObject, jsonByteLength } from './json';
import { OpRefusal, SurfaceOp, applyOp } from './jsonPointer';
import {
  SURFACE_CAPS,
  SurfaceEventEntry,
  SurfaceSnapshotEntry,
  SurfaceSpec,
  getDeclaredAction,
} from './schemas';

const logger = createDevLogger('surfaceReducer', false);

/**
 * The surface reducer: folds a channel's post set into the app's current
 * state under the authoritative spec. Pure and total — hostile input is
 * skipped (with a debug log), never thrown on. One shared implementation so
 * the client, tlon-skill, and tests cannot drift.
 *
 * Security core (plan §4.3):
 * - Identity comes only from `post.authorId`; nothing in blob content is
 *   ever trusted for identity.
 * - `mode: 'host'` raw ops fold only when the post author is the channel
 *   host, and only at the current spec revision (no stale exception).
 * - `mode: 'invoke'` events carry no ops. Ops come from the current spec's
 *   declared action; `$actor` resolves to the post author. Stale invokes
 *   fold only when the current action sets `acceptStale`, and always
 *   resolve against the CURRENT action. Future-revision events never fold.
 * - Edited posts are retractions (§6): any surface post marked edited is
 *   skipped wholesale.
 */

/**
 * The refusals one folded op can produce: `applyOp`'s own, plus the one cap
 * only the reducer can check, because only the reducer holds the whole
 * reduced state.
 */
type FoldRefusal = OpRefusal | 'state-cap';

/**
 * The refusals state makes, as opposed to the one the op makes about itself.
 * These abort the rest of the entry (§7); `grammar` alone skips the single
 * op and lets the entry continue.
 *
 * The criterion is not severity, and not whether the author could have seen
 * it coming — it is which of the two things was wrong. `grammar` means this
 * is not a well-formed op: a malformed or over-long pointer, a forbidden
 * segment, `$actor` misuse, a value that is not surface JSON. Nothing was
 * ever asked of state, the refusal is identical against every state, and the
 * rest of a mostly correct entry is still worth applying. The three here
 * mean the op is well formed and is exactly what the author meant, and
 * *state cannot take the write*: its shape has no such path (`structure`),
 * or the result would be more than state may hold (`depth-cap`,
 * `state-cap`). A later op in the same entry was written on the assumption
 * that this one landed — the "archive, then clear" rollover clearing
 * without archiving — so the entry stops, leaving state at the prefix that
 * did apply.
 *
 * A fourth kind goes on this side if the op it refuses is one a reader would
 * still call correct, and on the skip side if the op is malformed as
 * written. `depth-cap` is the one member that is computable from the op
 * alone, so a "could the author see it in the entry?" test would sort it
 * with `grammar`; it is here anyway, because what it means is "state cannot
 * hold this", and a `del` after a depth-refused `set` destroys data exactly
 * as it does after a size-refused one.
 *
 * Deterministic, and that is load-bearing: state is a pure function of the
 * post log, and all three are pure functions of state and the op — so every
 * client refuses at the same op of the same entry. Nothing here reads a
 * clock, an allocator, or anything else client-local.
 */
const STATE_REFUSALS: ReadonlySet<FoldRefusal> = new Set([
  'structure',
  'depth-cap',
  'state-cap',
]);

type FoldOutcome =
  | { ok: true; state: JsonObject }
  | { ok: false; refusal: FoldRefusal; error: string };

/**
 * One op against the current state under every cap that governs the fold.
 * `applyOp` enforces the op's own rules (grammar, `$actor`, value shape,
 * depth); the reduced-state size cap is added here. Both arrive as the same
 * kind of answer so the fold has one decision to make rather than two.
 */
function foldOp(
  state: JsonObject,
  op: SurfaceOp,
  actor: string | undefined
): FoldOutcome {
  const result = applyOp(state, op, actor === undefined ? {} : { actor });
  if (!result.ok) {
    return { ok: false, refusal: result.refusal, error: result.error };
  }
  if (
    result.changed &&
    jsonByteLength(result.state) > SURFACE_CAPS.reducedState
  ) {
    return {
      ok: false,
      refusal: 'state-cap',
      error: `state would exceed ${SURFACE_CAPS.reducedState} bytes`,
    };
  }
  return { ok: true, state: result.state };
}

/**
 * The slice of the client post model the reducer reads. Posts without a
 * numeric `sequenceNum` (unsynced optimistic posts, replies) are skipped —
 * only server-sequenced posts fold, so every client folds the same set.
 */
export interface SurfacePostView {
  authorId: string;
  sequenceNum?: number | null;
  isEdited?: boolean | null;
  isDeleted?: boolean | null;
  blob?: string | null;
}

export interface ReduceSurfaceInput {
  /** the validated, authoritative spec from the channel description */
  spec: SurfaceSpec;
  /** the channel host ship (from the channel id) — NOT from any post/blob */
  hostShip: string;
  /** hydrated posts, any order */
  posts: SurfacePostView[];
}

export interface SurfaceReductionReduced {
  status: 'reduced';
  state: JsonObject;
  /**
   * `upToSequenceNum` of the snapshot folded from, or null when folding
   * from `initialState` over the full post set.
   */
  baseSnapshotSeq: number | null;
  /**
   * The state's coverage watermark: the greatest `sequenceNum` that
   * contributed to `state` — the snapshot boundary or the last folded
   * event, whichever is greater. Null when the state is exactly
   * `initialState` with nothing folded. Hydration loops (§6) reason from
   * this rather than recomputing it from the post set; note that skipped
   * events never advance it.
   */
  newestFoldedSeq: number | null;
  /**
   * True when at least one op was refused for exceeding the reduced-state
   * size cap — and only that cap, because it is the one a host can repair by
   * snapshotting and pruning, which is what "dashboard full" asks for. The
   * other two `STATE_REFUSALS` are not repairable that way — pruning does not
   * make a path shallower, and it never turns a scalar into an object — so
   * neither raises this flag; `abortedEventCount` is what reports them.
   */
  stateFull: boolean;
  foldedEventCount: number;
  skippedEventCount: number;
  /**
   * Entries that stopped early because state refused one of their ops (§7).
   * The state is the prefix of such an entry that did apply, so a host that
   * reads a non-zero count knows its last entry landed only in part and must
   * be re-posted once the refusal is dealt with. Aborted entries still count
   * as folded and still advance `newestFoldedSeq`: they were processed to a
   * deterministic conclusion.
   */
  abortedEventCount: number;
}

export interface SurfaceReductionPending {
  status: 'migration-pending';
}

export type SurfaceReduction =
  | SurfaceReductionReduced
  | SurfaceReductionPending;

interface SequencedEntry<T> {
  sequenceNum: number;
  /** entry position within the post's blob, for a stable in-post order */
  entryIndex: number;
  authorId: string;
  entry: T;
}

function isSurfaceEvent(entry: { type: string }): entry is SurfaceEventEntry {
  return entry.type === 'surface-event';
}

function isSurfaceSnapshot(entry: {
  type: string;
}): entry is SurfaceSnapshotEntry {
  return entry.type === 'surface-snapshot';
}

export function reduceSurface(input: ReduceSurfaceInput): SurfaceReduction {
  const { spec, hostShip, posts } = input;

  // Collect validated surface entries from sequenced, unedited posts.
  const events: SequencedEntry<SurfaceEventEntry>[] = [];
  const snapshots: SequencedEntry<SurfaceSnapshotEntry>[] = [];
  for (const post of posts) {
    if (
      post == null ||
      typeof post.sequenceNum !== 'number' ||
      !Number.isFinite(post.sequenceNum) ||
      post.isDeleted ||
      // Edits retract (§6): the backend replaces the essay in place, so an
      // edited surface post no longer represents what was originally folded.
      post.isEdited ||
      typeof post.blob !== 'string' ||
      post.blob.length === 0 ||
      typeof post.authorId !== 'string'
    ) {
      continue;
    }
    const entries = parsePostBlob(post.blob);
    entries.forEach((entry, entryIndex) => {
      if (isSurfaceEvent(entry) && entry.surfaceId === spec.surfaceId) {
        events.push({
          sequenceNum: post.sequenceNum as number,
          entryIndex,
          authorId: post.authorId,
          entry,
        });
      } else if (
        isSurfaceSnapshot(entry) &&
        entry.surfaceId === spec.surfaceId
      ) {
        snapshots.push({
          sequenceNum: post.sequenceNum as number,
          entryIndex,
          authorId: post.authorId,
          entry,
        });
      }
      // surface-spec-mirror and every other entry type: not the reducer's.
    });
  }

  const bySequence = <T>(a: SequencedEntry<T>, b: SequencedEntry<T>) =>
    a.sequenceNum - b.sequenceNum || a.entryIndex - b.entryIndex;
  events.sort(bySequence);
  snapshots.sort(bySequence);

  // Snapshot selection (§4.4): host-authored, current-revision only; the
  // effective snapshot has the greatest upToSequenceNum. Ties resolve to
  // the latest-sequenced entry (host-degenerate but deterministic).
  let snapshot: SurfaceSnapshotEntry | null = null;
  for (const candidate of snapshots) {
    if (candidate.authorId !== hostShip) {
      logger.log('skipping non-host snapshot', candidate.sequenceNum);
      continue;
    }
    if (candidate.entry.specRevision !== spec.specRevision) {
      logger.log('skipping wrong-revision snapshot', candidate.sequenceNum);
      continue;
    }
    if (
      snapshot === null ||
      candidate.entry.upToSequenceNum >= snapshot.upToSequenceNum
    ) {
      snapshot = candidate.entry;
    }
  }

  // Migration gate (§6): a preserving revision has no state until the host
  // posts a snapshot at exactly this revision.
  if (spec.preserveState === true && snapshot === null) {
    return { status: 'migration-pending' };
  }

  let state: JsonObject = snapshot ? snapshot.state : spec.initialState;
  const boundary = snapshot ? snapshot.upToSequenceNum : -Infinity;
  let stateFull = false;
  let foldedEventCount = 0;
  let skippedEventCount = 0;
  let abortedEventCount = 0;
  let newestFoldedSeq: number | null = snapshot
    ? snapshot.upToSequenceNum
    : null;

  for (const { sequenceNum, authorId, entry } of events) {
    // Snapshots finalize (§6): events at or below the boundary are frozen
    // into the snapshot and never refolded.
    if (sequenceNum <= boundary) {
      continue;
    }

    let ops;
    let actor: string | undefined;
    if (entry.mode === 'host') {
      if (authorId !== hostShip) {
        logger.log('skipping non-host raw ops', sequenceNum);
        skippedEventCount++;
        continue;
      }
      // No stale exception for host events: a stale or future revision tag
      // drops the event, so a non-preserving revision reset never replays.
      if (entry.specRevision !== spec.specRevision) {
        logger.log('skipping wrong-revision host event', sequenceNum);
        skippedEventCount++;
        continue;
      }
      ops = entry.ops;
      actor = undefined;
    } else {
      const action = getDeclaredAction(spec, entry.actionId);
      if (!action) {
        logger.log('skipping invoke of undeclared action', entry.actionId);
        skippedEventCount++;
        continue;
      }
      if (entry.specRevision !== spec.specRevision) {
        const isStale = entry.specRevision < spec.specRevision;
        if (!isStale || action.acceptStale !== true) {
          logger.log('skipping off-revision invoke', sequenceNum);
          skippedEventCount++;
          continue;
        }
        // Stale invoke accepted: resolved against the CURRENT action.
      }
      ops = action.ops;
      actor = authorId;
    }

    for (const op of ops) {
      const outcome = foldOp(state, op, actor);
      if (outcome.ok) {
        state = outcome.state;
        continue;
      }
      if (outcome.refusal === 'state-cap') {
        stateFull = true;
      }
      if (!STATE_REFUSALS.has(outcome.refusal)) {
        // Malformed op: this op alone is void, the entry continues (§7).
        logger.log('skipping op', op.op, op.path, outcome.error);
        continue;
      }
      // State refused a well-formed op: the ops after this one were written
      // on the assumption that it landed, so none of them apply (§7).
      logger.log('aborting entry at op', op.op, op.path, outcome.error);
      abortedEventCount++;
      break;
    }
    foldedEventCount++;
    // events are sorted ascending, so the last folded one is the greatest
    newestFoldedSeq = sequenceNum;
  }

  return {
    status: 'reduced',
    state,
    baseSnapshotSeq: snapshot ? snapshot.upToSequenceNum : null,
    newestFoldedSeq,
    stateFull,
    foldedEventCount,
    skippedEventCount,
    abortedEventCount,
  };
}
