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
 *
 * The kind carries the message and raises `stateFull`. It deliberately does
 * **not** decide what the fold does next: every refusal aborts the rest of
 * its entry (§7), so there is no set of abort-kinds here to add a member to,
 * and a new kind needs no ruling on which side it belongs.
 *
 * The withdrawn criterion sorted refusals by which of the op and the state
 * was wrong, skipping `grammar` alone. It was reproduced losing data: a `set`
 * whose path is missing its leading `/` is a `grammar` refusal, so it skipped
 * and the `del /today` after it — written to run only once the archiving
 * `set` had landed — still cleared the day. Dependency does not track blame.
 * What matters is whether the ops after a refusal were written assuming it
 * landed, and that is true however the refusal came about.
 *
 * Determinism is what lets the fold abort at all: state is a pure function of
 * the post log, and every refusal is a pure function of state and the op, so
 * every client aborts at the same op of the same entry. Nothing in the
 * decision reads a clock, an allocator, or anything else client-local.
 */
type FoldRefusal = OpRefusal | 'state-cap';

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
  /**
   * The host-stamped post id, used ONLY to break a sequence-number tie.
   *
   * `sequenceNum` is not guaranteed unique — there is no unique index on
   * `(channelId, sequenceNum)`, and two posts sharing one tie completely in
   * the sort, making the fold depend on the order posts happened to arrive
   * in. Two clients holding the same posts would then converge on different
   * state, which §6 promises cannot happen.
   *
   * The id is stamped by the host on the same event as the sequence number
   * and increases in the same order (`channels-server.hoon` derives it from
   * `now.bowl` with a collision bump), so it is the natural second key.
   *
   * REQUIRED (D189). It was optional, and `comparePostIds` returned equality
   * whenever either side was absent — so two tied id-less posts sorted in
   * caller order and the exported "posts, any order" contract was false for
   * anything that did not carry ids. An optional tie-break key is not a
   * tie-break: making it required is what makes the contract true at the
   * type level rather than true only for the one producer that happened to
   * fill it in.
   */
  id: string;
}

export interface ReduceSurfaceInput {
  /** the validated, authoritative spec from the channel description */
  spec: SurfaceSpec;
  /** the channel host ship (from the channel id) — NOT from any post/blob */
  hostShip: string;
  /** hydrated posts, any order */
  posts: SurfacePostView[];
  /**
   * The channel's advertised head — the greatest sequence number the SERVER
   * says exists (`channels.lastPostSequenceNum`). Optional; when supplied,
   * a snapshot claiming to cover posts beyond it is refused.
   *
   * `upToSequenceNum` reads like a checked invariant in §4.4 and is only a
   * writer obligation: nothing stopped a snapshot from claiming
   * `upTo: 1_000_000`. Such a snapshot wins selection forever (selection
   * takes the greatest), freezes every event below its boundary, and leaves
   * the board at `foldedEventCount: 0` permanently — recoverable only by
   * deleting that specific post. The realistic trigger is not malice but a
   * writer putting a millisecond timestamp in the field.
   *
   * The head is a SERVER watermark that can legitimately sit above
   * everything the client holds, which is exactly what makes it a usable
   * ceiling — a locally-derived head would compare local against local and
   * pass unconditionally.
   */
  advertisedHead?: number | null;
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
   * snapshotting and pruning, which is what "dashboard full" asks for. No
   * other refusal is repairable that way: pruning does not make a path
   * shallower, it never turns a scalar into an object, and it certainly does
   * not put a leading `/` on a malformed path. `abortedSequenceNums` is what
   * reports those.
   */
  stateFull: boolean;
  foldedEventCount: number;
  skippedEventCount: number;
  /**
   * The `sequenceNum` of every entry that stopped early because one of its ops
   * was refused (§7) — every refusal, not a subset — in ascending order.
   *
   * The state is the prefix of such an entry that did apply, so a host reading
   * a non-empty list knows its last entry landed only in part and must be
   * re-posted once the refusal is dealt with. Aborted entries still count as
   * folded and still advance `newestFoldedSeq`: they were processed to a
   * deterministic conclusion.
   *
   * One element per aborted ENTRY, not per post, so `.length` is exactly the
   * count this replaced: a post whose blob carries two entries that both stop
   * early contributes its sequence number twice.
   *
   * This is the sequence numbers rather than a count because every consumer
   * that reports an abort has to say WHICH post to go and look at — and a
   * count carrying an escape hatch through (`--allow-aborted-events`) leaves
   * no audit trail of what it waved past. A count is `.length`; keeping both
   * would be two representations of one fact, free to drift.
   */
  abortedSequenceNums: number[];
  /**
   * The `sequenceNum` of every otherwise-eligible snapshot skipped for
   * claiming coverage beyond `advertisedHead` (D175), ascending.
   *
   * Reported rather than only logged (D190) because skipping is not a repair.
   * The bad snapshot still sits in the channel, still wins selection on any
   * reader that folds without a head, and — since selection takes the
   * GREATEST boundary — still beats any honest snapshot written after it. A
   * writer that folds past one and then snapshots would launder the boundary
   * into a fresh post while the original stands. So the fold says which post
   * it had to step over, and a writer refuses on a non-empty list and names
   * it, instead of quietly producing a correct-looking state.
   */
  headExceededSnapshots: number[];
}

export interface SurfaceReductionPending {
  status: 'migration-pending';
  /**
   * Same meaning as on a reduced fold, and present here for the case that
   * makes it matter most: a preserving revision whose ONLY snapshot claims
   * coverage beyond the head. Skipping it leaves the revision migration-
   * pending, which reads as "the host has not posted one yet" — so a repair
   * path writes a fresh snapshot at an honest boundary, the bad one keeps
   * winning selection because selection takes the greatest boundary, and the
   * repair reports success having changed nothing.
   */
  headExceededSnapshots: number[];
}

export type SurfaceReduction =
  | SurfaceReductionReduced
  | SurfaceReductionPending;

interface SequencedEntry<T> {
  sequenceNum: number;
  /** the post's host-stamped id, to break a sequence-number tie */
  postId: string;
  /** entry position within the post's blob, for a stable in-post order */
  entryIndex: number;
  authorId: string;
  entry: T;
}

/**
 * Total order on host post ids, for the sequence-number tie only.
 *
 * Post ids are canonical dotted `@ud` renders (`170.141.184.505…`), which
 * are monotonic NUMERICALLY but not lexicographically: `9` sorts after
 * `10` under a plain string compare, and the dots make the digits
 * non-aligned. So compare by digit count first, then lexicographically —
 * equivalent to a numeric compare, without parsing arbitrarily large
 * integers.
 *
 * Non-numeric ids exist (sequence stubs are `sequence-stub-<channel>-<n>`),
 * so those fall back to a plain string compare. Any total order will do;
 * what matters is that every client picks the SAME one — which means it has
 * to BE one. Two ways it was not (D189):
 *
 *   - `1.000` and `1000` carry the same digits, so neither `<` held and both
 *     directions returned 1: `a > b` and `b > a` at once.
 *   - Numeric and non-numeric ids were compared raw against each other, so
 *     `"2" > "1x" > "10" > "2"` closed a cycle across the two classes.
 *
 * Both are fixed by ordering the CLASSES first — every numeric id below
 * every non-numeric one — and by falling through to the raw compare when
 * two numeric ids agree on digits. `surfaceReducer.test.ts` generates ids
 * across both classes and asserts antisymmetry and transitivity directly.
 */
function comparePostIds(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  const digitsA = a.replace(/\./g, '');
  const digitsB = b.replace(/\./g, '');
  const numericA = /^\d+$/.test(digitsA);
  const numericB = /^\d+$/.test(digitsB);
  if (numericA !== numericB) {
    return numericA ? -1 : 1;
  }
  if (numericA) {
    if (digitsA.length !== digitsB.length) {
      return digitsA.length - digitsB.length;
    }
    if (digitsA !== digitsB) {
      return digitsA < digitsB ? -1 : 1;
    }
    // Same number, different rendering (`1.000` vs `1000`). Distinct ids, so
    // the order must still separate them; the raw compare is a total order
    // on strings and settles it.
  }
  return a < b ? -1 : 1;
}

/** Exported for the order's own property tests; not part of the fold API. */
export const __comparePostIdsForTest = comparePostIds;

function isSurfaceEvent(entry: { type: string }): entry is SurfaceEventEntry {
  return entry.type === 'surface-event';
}

function isSurfaceSnapshot(entry: {
  type: string;
}): entry is SurfaceSnapshotEntry {
  return entry.type === 'surface-snapshot';
}

export function reduceSurface(input: ReduceSurfaceInput): SurfaceReduction {
  const { spec, hostShip, posts, advertisedHead } = input;

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
      typeof post.authorId !== 'string' ||
      // The tie-break key is required (D189). A post that arrives without one
      // cannot be ordered against a post sharing its sequence number, so
      // folding it would reintroduce exactly the arrival-order dependence the
      // key exists to remove. Structurally unfoldable, like a post with no
      // sequence number — the type says so and this enforces it for callers
      // that are not typechecked against us.
      typeof post.id !== 'string'
    ) {
      continue;
    }
    const entries = parsePostBlob(post.blob);
    entries.forEach((entry, entryIndex) => {
      if (isSurfaceEvent(entry) && entry.surfaceId === spec.surfaceId) {
        events.push({
          sequenceNum: post.sequenceNum as number,
          postId: post.id,
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
          postId: post.id,
          entryIndex,
          authorId: post.authorId,
          entry,
        });
      }
      // surface-spec-mirror and every other entry type: not the reducer's.
    });
  }

  // sequence, then the host post id, then position within the post. The
  // middle key is what makes the fold independent of arrival order when two
  // posts share a sequence number (D174).
  const bySequence = <T>(a: SequencedEntry<T>, b: SequencedEntry<T>) =>
    a.sequenceNum - b.sequenceNum ||
    comparePostIds(a.postId, b.postId) ||
    a.entryIndex - b.entryIndex;
  events.sort(bySequence);
  snapshots.sort(bySequence);

  // Snapshot selection (§4.4): host-authored, current-revision only; the
  // effective snapshot has the greatest upToSequenceNum. Ties resolve to
  // the latest-sequenced entry (host-degenerate but deterministic).
  let snapshot: SurfaceSnapshotEntry | null = null;
  const headExceededSnapshots: number[] = [];
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
      advertisedHead !== undefined &&
      advertisedHead !== null &&
      candidate.entry.upToSequenceNum > advertisedHead
    ) {
      // A snapshot cannot cover posts that do not exist. Skipping rather
      // than clamping: a boundary this wrong means the writer's state is
      // untrustworthy too, so the honest move is to fold the real log.
      logger.log(
        'skipping snapshot claiming coverage beyond the advertised head',
        candidate.entry.upToSequenceNum,
        advertisedHead
      );
      headExceededSnapshots.push(candidate.sequenceNum);
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
    return { status: 'migration-pending', headExceededSnapshots };
  }

  let state: JsonObject = snapshot ? snapshot.state : spec.initialState;
  const boundary = snapshot ? snapshot.upToSequenceNum : -Infinity;
  let stateFull = false;
  let foldedEventCount = 0;
  let skippedEventCount = 0;
  const abortedSequenceNums: number[] = [];
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
      // EVERY refusal aborts (§7): the ops after this one were written on the
      // assumption that it landed, and whether that is so has nothing to do
      // with why it was refused. `outcome.refusal` is read above for
      // `stateFull` and below for the log line, and nowhere else — do not
      // reintroduce a kind-based branch here.
      logger.log('aborting entry at op', op.op, op.path, outcome.error);
      abortedSequenceNums.push(sequenceNum);
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
    abortedSequenceNums,
    headExceededSnapshots,
  };
}
