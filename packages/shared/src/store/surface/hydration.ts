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
  if (posts.length === 0) {
    const latestSeq = await db.getLatestChannelSequenceNum({ channelId });
    if (latestSeq === 0) {
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
    }
    if (posts.length === 0) {
      // no loadable window over a non-empty (or unknown) channel
      return partialState(spec, null, null);
    }
  }

  for (let page = 0; page <= maxPages; page++) {
    const oldest = posts.at(-1)?.sequenceNum ?? null;
    const newest = posts[0]?.sequenceNum ?? null;
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
  return partialState(
    spec,
    posts.at(-1)?.sequenceNum ?? null,
    posts[0]?.sequenceNum ?? null
  );
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
