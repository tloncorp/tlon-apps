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
  count: number,
  backfill: HydrateSurfaceOptions['backfill']
): Promise<db.Post[]> {
  const local = await db.getSequencedChannelPosts({
    channelId,
    mode: 'older',
    cursorSequenceNum,
    count,
  });
  if (local.length > 0) {
    return local;
  }
  if (!backfill) {
    return [];
  }
  await backfill({ channelId, mode: 'older', cursorSequenceNum, count });
  return db.getSequencedChannelPosts({
    channelId,
    mode: 'older',
    cursorSequenceNum,
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
      return completeState(channelId, spec, []);
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

  for (let page = 0; page <= maxPages; page++) {
    const oldest = oldestOf(posts);
    const newest = newestOf(posts);
    const reduction = reduceSurfaceChannel({ channelId, spec, posts });

    const coveredToStart = oldest === 1;
    const coveredBySnapshot =
      reduction.status === 'reduced' &&
      reduction.baseSnapshotSeq !== null &&
      oldest !== null &&
      reduction.baseSnapshotSeq >= oldest - 1;

    if (coveredToStart || coveredBySnapshot) {
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
      pageSize,
      backfill
    );
    if (older.length === 0) {
      logger.log('no older posts available below', oldest);
      return partialState(spec, oldest, newest);
    }
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
  posts: db.Post[]
): SurfaceHydrationState {
  const reduction = reduceSurfaceChannel({ channelId, spec, posts });
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
