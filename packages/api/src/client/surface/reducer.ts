import { createDevLogger } from '../../lib/logger';
import { parsePostBlob } from '../content-helpers';
import { JsonObject, jsonByteLength } from './json';
import { applyOp } from './jsonPointer';
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
  /** true when at least one op was refused for exceeding the state cap */
  stateFull: boolean;
  foldedEventCount: number;
  skippedEventCount: number;
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
      const result = applyOp(state, op, actor === undefined ? {} : { actor });
      if (!result.ok) {
        // A violation invalidates the single op; remaining ops apply (§7).
        logger.log('skipping op', op.op, op.path, result.error);
        continue;
      }
      if (
        result.changed &&
        jsonByteLength(result.state) > SURFACE_CAPS.reducedState
      ) {
        // State cap: the op is refused, state stays as it was, and the
        // surface reports "dashboard full" (§7). Later ops still apply —
        // a del can shrink state back under the cap.
        logger.log('refusing op over state cap', op.op, op.path);
        stateFull = true;
        continue;
      }
      state = result.state;
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
  };
}
