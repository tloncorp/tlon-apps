import {
  JsonObject,
  SurfaceReductionReduced,
  SurfaceSpec,
  readSurfaceSpec,
} from '@tloncorp/api';

import * as db from '../../db';
import { createDevLogger } from '../../debug';
import { reduceSurfaceChannel } from './adapter';

const logger = createDevLogger('surfaceHydration', false);

/**
 * The §6 hydration loop at the data layer: read the raw persisted spec,
 * page backward by sequenceNum over the existing sequenced-post machinery
 * until the fold's coverage is contiguous with the effective snapshot
 * boundary or the channel start, and reduce. No UI here; "bundle
 * unavailable" and "update to view" for shellVersion belong to the
 * renderer sessions.
 *
 * Coverage has TWO ends and both are proven before any state is presented.
 * The oldest end is the paging loop below. The newest end is the channel's
 * advertised head: local rows routinely trail the backend, and folding a
 * truncated history would hand the renderer a state that another client
 * has already moved past — two clients silently disagreeing about
 * "current". Per §6 an incomplete fold is wrong derived state, not stale
 * state, so a fold that cannot reach the head reports `partial` and
 * carries nothing.
 */

export type SurfaceHydrationStatus =
  /** spec-read results (§6 step 1) */
  | 'absent'
  | 'invalid'
  | 'version-too-new'
  /** preserving spec with no current-revision snapshot yet (§6 step 3) */
  | 'migration-pending'
  /** coverage is not yet contiguous with the boundary or channel start */
  | 'partial'
  | 'hydrated';

export interface SurfaceHydrationState {
  status: SurfaceHydrationStatus;
  /** the validated spec, whenever it was readable */
  spec?: SurfaceSpec;
  /** declared version, for 'version-too-new' */
  specVersion?: number;
  /**
   * Reduced state — present only when 'hydrated'. A partial fold is never
   * presented as current (§6).
   */
  state?: JsonObject;
  /** "dashboard full" indicator, when hydrated */
  stateFull?: boolean;
  /** the full reduction, when hydrated */
  reduction?: SurfaceReductionReduced;
  /** loaded-window diagnostics for loading UI */
  oldestLoadedSeq?: number | null;
  newestLoadedSeq?: number | null;
}

type BackfillOptions = {
  channelId: string;
  mode: 'newest' | 'older';
  cursorSequenceNum?: number;
  /**
   * The id half of the cursor, when the caller has one (D201).
   *
   * The remote fetch is a sequence RANGE, not a tuple cursor, so this does not
   * narrow what comes back — a range covering the cursor's rung returns every
   * row on it either way, which is exactly what the boundary probe needs. It
   * travels so the request records which tie it was asked about, and so a
   * later transport that CAN express a tuple has somewhere to read it from.
   */
  cursorTiePostId?: string;
  count: number;
};

export interface HydrateSurfaceOptions {
  channelId: string;
  pageSize?: number;
  /** hard bound on backward paging per hydrate call; partial beyond it */
  maxPages?: number;
  /**
   * Injected remote backfill, called only when the local window runs dry.
   * Defaults to the sync layer at the hook; tests inject fixtures/noops.
   * The cache/fetch separation mirrors the bundle cache: this module knows
   * paging, not the network.
   */
  backfill?: (options: BackfillOptions) => Promise<void>;
}

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_PAGES = 40;

async function readOlderLocalFirst(
  channelId: string,
  cursorSequenceNum: number,
  cursorTiePostId: string | undefined,
  count: number,
  backfill: HydrateSurfaceOptions['backfill']
): Promise<db.Post[]> {
  // `cursorTiePostId` is the second half of the page cursor (D187). Without it a
  // post tied on `sequenceNum` with the last row of the previous page is
  // stepped over and never read again, and the reducer breaks a tie it can
  // only see one side of.
  const local = await db.getSequencedChannelPosts({
    channelId,
    mode: 'older',
    cursorSequenceNum,
    cursorTiePostId,
    count,
  });
  if (local.length > 0) {
    return local;
  }
  if (!backfill) {
    return [];
  }
  await backfill({
    channelId,
    mode: 'older',
    cursorSequenceNum,
    cursorTiePostId,
    count,
  });
  return db.getSequencedChannelPosts({
    channelId,
    mode: 'older',
    cursorSequenceNum,
    cursorTiePostId,
    count,
  });
}

export async function hydrateSurface(
  options: HydrateSurfaceOptions
): Promise<SurfaceHydrationState> {
  const {
    channelId,
    pageSize = DEFAULT_PAGE_SIZE,
    maxPages = DEFAULT_MAX_PAGES,
    backfill,
  } = options;

  const channel = await db.getChannel({ id: channelId });
  const specRead = readSurfaceSpec(channel?.surfaceSpec);
  if (specRead.status === 'absent') {
    return { status: 'absent' };
  }
  if (specRead.status === 'invalid') {
    // never a chat fallback, and events are never folded without a
    // governing spec (§6 step 1)
    return { status: 'invalid' };
  }
  if (specRead.status === 'version-too-new') {
    return { status: 'version-too-new', specVersion: specRead.version };
  }
  const spec = specRead.spec;

  // newest contiguous window first
  let posts = await db.getSequencedChannelPosts({
    channelId,
    mode: 'newest',
    count: pageSize,
  });
  let head = await db.getLatestChannelSequenceNum({ channelId });
  if (posts.length === 0) {
    if (head === 0) {
      // genuinely empty channel: fold over nothing
      return completeState(channelId, spec, [], head);
    }
    // posts exist remotely (or we can't tell): try one backfill
    if (backfill) {
      await backfill({ channelId, mode: 'newest', count: pageSize });
      posts = await db.getSequencedChannelPosts({
        channelId,
        mode: 'newest',
        count: pageSize,
      });
      head = await db.getLatestChannelSequenceNum({ channelId });
    }
    if (posts.length === 0) {
      // no loadable window over a non-empty (or unknown) channel
      return partialState(spec, null, null);
    }
  }

  // Newest-end coverage, settled before any paging: the window anchors at the
  // newest local row and the loop below only ever extends it downward, so this
  // never changes once decided. One backfill attempt, then a decision — the
  // same single-shot discipline as `readOlderLocalFirst`, which is what keeps
  // a channel whose head we can never reach from looping the network forever.
  if (!reachesHead(newestOf(posts), head) && backfill) {
    await backfill({ channelId, mode: 'newest', count: pageSize });
    posts = await db.getSequencedChannelPosts({
      channelId,
      mode: 'newest',
      count: pageSize,
    });
    head = await db.getLatestChannelSequenceNum({ channelId });
  }
  if (!reachesHead(newestOf(posts), head)) {
    logger.log('window does not reach the advertised head', {
      channelId,
      newest: newestOf(posts),
      head,
    });
    return partialState(spec, oldestOf(posts), newestOf(posts));
  }

  const probedBoundaries = new Set<string>();
  // Whether the fetch that produced the current oldest rung came back full.
  // A full page may have been cut mid-rung; a short one proves it was not.
  let lastPageWasFull = posts.length >= pageSize;
  for (let page = 0; page <= maxPages; page++) {
    const oldest = oldestOf(posts);
    const newest = newestOf(posts);
    const reduction = reduceSurfaceChannel({
      channelId,
      spec,
      posts,
      advertisedHead: head,
    });

    const coveredToStart = oldest === 1;
    const coveredBySnapshot =
      reduction.status === 'reduced' &&
      reduction.baseSnapshotSeq !== null &&
      oldest !== null &&
      reduction.baseSnapshotSeq >= oldest - 1;

    /**
     * Coverage is a claim about a RUNG, and `oldest === 1` is a claim about a
     * NUMBER (D201).
     *
     * Two posts can share a sequence number, and the fetch that filled this
     * client's window is count-limited: `syncInitialPosts` asks for 30 or 50
     * posts, and the backend serves that as a count, not as a tuple cursor. So
     * a tied pair straddling the count boundary arrives here as one row, the
     * numeric tests below both pass, and a fresh client folds one of two events
     * while a client that was already caught up folds both. That is the
     * cross-client divergence §6 promises cannot happen, reached without any
     * post being deleted or edited.
     *
     * A number cannot prove rung cardinality, so ask — but only when the local
     * data gives a reason to, because "everything was local, the network was
     * never touched" is a property this loop already holds and is worth
     * keeping.
     *
     * The reason is exact and free: **a page that came back FULL may have been
     * cut mid-rung; a page that came back short proves it was not.** A fetch
     * that returns fewer rows than it was asked for reached the end of what
     * exists, so its oldest rung is whole. A fetch that returns exactly its
     * count may have stopped one row into a tie. So the probe fires only after
     * a full page, which is precisely the case the count-limited initial sync
     * produces and never the case a fully-local walk ends in.
     *
     * The probe itself is local first — `readOlderLocalFirst` only reaches the
     * network when the local read is dry — and the remote fetch is a sequence
     * RANGE, so a range covering this rung returns every row on it. If a
     * sibling exists it lands and the fold continues with it.
     *
     * Bounded by construction: the probe key is the boundary tuple, which
     * strictly decreases every time a row is added below it, so no tuple is
     * probed twice and the loop's own page budget still bounds the whole walk.
     */
    if (coveredToStart || coveredBySnapshot) {
      const boundaryKey = `${oldest}:${oldestIdOf(posts) ?? ''}`;
      if (
        oldest !== null &&
        lastPageWasFull &&
        !probedBoundaries.has(boundaryKey)
      ) {
        probedBoundaries.add(boundaryKey);
        const below = await readOlderLocalFirst(
          channelId,
          oldest,
          oldestIdOf(posts),
          pageSize,
          backfill
        );
        // Only the rows on the BOUNDARY RUNG. The question is whether this rung
        // is whole, not what lies beneath it — a snapshot boundary means the
        // rows below are deliberately not folded, and dragging them in would
        // page a covered channel back to its start for nothing.
        const tied = below.filter((post) => post.sequenceNum === oldest);
        if (tied.length > 0) {
          posts = [...posts, ...tied];
          lastPageWasFull = tied.length >= pageSize;
          continue;
        }
      }
      if (reduction.status === 'migration-pending') {
        // full history searched, no current-revision snapshot (§6 step 3)
        return {
          status: 'migration-pending',
          spec,
          oldestLoadedSeq: oldest,
          newestLoadedSeq: newest,
        };
      }
      return {
        status: 'hydrated',
        spec,
        state: reduction.state,
        stateFull: reduction.stateFull,
        reduction,
        oldestLoadedSeq: oldest,
        newestLoadedSeq: newest,
      };
    }

    if (oldest === null || oldest <= 1) {
      return partialState(spec, oldest, newest);
    }

    const older = await readOlderLocalFirst(
      channelId,
      oldest,
      oldestIdOf(posts),
      pageSize,
      backfill
    );
    if (older.length === 0) {
      logger.log('no older posts available below', oldest);
      return partialState(spec, oldest, newest);
    }
    lastPageWasFull = older.length >= pageSize;
    posts = [...posts, ...older];
  }

  logger.trackError('surface hydration exceeded page budget', {
    channelId,
    maxPages,
  });
  return partialState(spec, oldestOf(posts), newestOf(posts));
}

function oldestOf(posts: db.Post[]): number | null {
  return posts.at(-1)?.sequenceNum ?? null;
}

/**
 * The id of the oldest loaded row — the other half of the page cursor.
 *
 * The window is ordered `(sequenceNum, id)` descending, so the last element is
 * the least row under that order and paging resumes strictly below it.
 */
function oldestIdOf(posts: db.Post[]): string | undefined {
  return posts.at(-1)?.id ?? undefined;
}

function newestOf(posts: db.Post[]): number | null {
  return posts[0]?.sequenceNum ?? null;
}

/**
 * Does the loaded window reach the channel's advertised head?
 *
 * `head` is `channels.lastPostSequenceNum`, which sync writes from the
 * `newest` field the posts scry returns (`setLatestChannelSequenceNum`) and
 * otherwise only ever raises to the newest local row. It is therefore a
 * SERVER watermark that can legitimately sit above everything we hold —
 * which is the whole point: a purely locally-derived head would compare
 * local against local and pass unconditionally.
 *
 * Compares the newest LOADED sequence number, not the newest FOLDED one.
 * A surface channel's head post is frequently an ordinary chat message that
 * folds no event, and `newestFoldedSeq` would then sit below the head
 * forever, wedging every such channel on `partial`. What has to be proven is
 * that no post exists above our window — that the fold isn't truncated — not
 * that the head post happened to carry an event.
 */
function reachesHead(
  newestLoadedSeq: number | null,
  head: number | null
): boolean {
  if (newestLoadedSeq === null) {
    return false;
  }
  if (head === null) {
    // Never synced a head for this channel, so coverage is unprovable. §6
    // makes the tie-break for us: an incomplete fold is wrong derived state,
    // not stale state. A surface parked on a loading indicator is visibly
    // unfinished and recovers on the next sync; a surface confidently
    // rendering a truncated history disagrees with every other client and
    // says nothing about it. So absence of a head withholds state.
    //
    // Nearly unreachable in practice: any channel holding sequenced posts
    // locally has had the watermark set by `setLastPostsMonotonic` on
    // insert, so a null head with a non-empty window means the local store
    // is in a state we cannot reason about anyway.
    return false;
  }
  return newestLoadedSeq >= head;
}

function partialState(
  spec: SurfaceSpec,
  oldestLoadedSeq: number | null,
  newestLoadedSeq: number | null
): SurfaceHydrationState {
  return { status: 'partial', spec, oldestLoadedSeq, newestLoadedSeq };
}

function completeState(
  channelId: string,
  spec: SurfaceSpec,
  posts: db.Post[],
  advertisedHead: number | null
): SurfaceHydrationState {
  const reduction = reduceSurfaceChannel({
    channelId,
    spec,
    posts,
    advertisedHead,
  });
  if (reduction.status === 'migration-pending') {
    return { status: 'migration-pending', spec };
  }
  return {
    status: 'hydrated',
    spec,
    state: reduction.state,
    stateFull: reduction.stateFull,
    reduction,
    oldestLoadedSeq: null,
    newestLoadedSeq: null,
  };
}
