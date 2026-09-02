import { QueryObserver } from '@tanstack/react-query';
import { StructuredChannelDescriptionPayload as SCDP } from '@tloncorp/api';
import { toClientGroups } from '@tloncorp/api';
import type * as ub from '@tloncorp/api/urbit/groups';
import { afterEach, expect, test, vi } from 'vitest';

import * as db from '../../db';
import { queryClient } from '../../db/reactQuery';
import { setupDatabaseTestSuite } from '../../test/helpers';
import { SurfaceHydrationState, hydrateSurface } from './hydration';
import { surfaceHydrationQueryKey } from './useSurfaceHydration';

/**
 * A mounted board re-folds if and only if the table-effect predicate in
 * `db/query.ts` picks its query out of the cache: the app's client runs with
 * `staleTime: Infinity` (`db/reactQuery.ts`), so nothing here ever goes stale
 * with time, on remount, or on focus. That predicate reads `queryKey[1]` and
 * no other position, and nothing type-checks the position — a key that parks
 * its deps anywhere else keeps rendering the fold it happened to compute
 * first, forever.
 *
 * So these tests drive the real path rather than restating it: a live
 * `QueryObserver` (what `useQuery` is built on) over the exported key, the
 * real `hydrateSurface` as its fetcher, a real write through the real query
 * wrapper, and then whatever fold the observer is holding.
 */

setupDatabaseTestSuite();

const GROUP = '~zod/dashboards';
const CHANNEL = 'chat/~zod/dashboard';
const SURFACE = 'srf-dash';
const MEMBER = '~ten';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const subscriptions: (() => void)[] = [];

afterEach(() => {
  subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
  queryClient.clear();
});

function surfaceSpec({ sha256 }: { sha256: string }) {
  return {
    version: 1,
    surfaceId: SURFACE,
    specRevision: 1,
    bundle: {
      assetRef: `https://storage.example/${sha256}`,
      sha256,
      size: 512,
      shellVersion: 1,
    },
    initialState: { log: [] },
    actions: {
      'log-entry': {
        ops: [{ op: 'append', path: '/log', value: '$actor' }],
        acceptStale: true,
      },
    },
  };
}

/** The `%groups` payload for a group holding one surface channel. */
function groupPayload(spec: ReturnType<typeof surfaceSpec>) {
  const description = SCDP.encode({
    description: 'Dashboard',
    surfaceSpec: spec as never,
  }) as string;
  return {
    [GROUP]: {
      meta: { title: 'Dashboards', description: '', image: '', cover: '' },
      admissions: { privacy: 'public' },
      seats: {},
      roles: {},
      channels: {
        [CHANNEL]: {
          join: true,
          added: 1,
          readers: [],
          zone: 'default',
          meta: { title: 'Dash', description, image: '', cover: '' },
        },
      },
      'active-channels': [CHANNEL],
      sections: {},
      'section-order': [],
    },
  } as unknown as Record<string, ub.GroupV11>;
}

/** One group sync, exactly as the client performs it (see D59). */
async function syncGroupFromShip(spec: ReturnType<typeof surfaceSpec>) {
  await db.insertGroups({ groups: toClientGroups(groupPayload(spec), true) });
}

function invokePost(sequenceNum: number) {
  return {
    id: `post-${sequenceNum}`,
    type: 'chat',
    channelId: CHANNEL,
    authorId: MEMBER,
    sentAt: sequenceNum * 1000,
    receivedAt: sequenceNum * 1000,
    sequenceNum,
    blob: JSON.stringify([
      {
        type: 'surface-event',
        version: 1,
        surfaceId: SURFACE,
        specRevision: 1,
        mode: 'invoke',
        actionId: 'log-entry',
      },
    ]),
    syncedAt: 0,
  } as db.Post;
}

/**
 * Writes schedule their invalidation on the next macrotask, so setup effects
 * have to drain before a test starts counting the fetches its own write
 * causes.
 */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A mounted board: the exported key, the real fold, an active observer. */
function mountBoard() {
  let fetches = 0;
  const observer = new QueryObserver<SurfaceHydrationState>(queryClient, {
    queryKey: surfaceHydrationQueryKey(CHANNEL),
    queryFn: () => {
      fetches++;
      return hydrateSurface({
        channelId: CHANNEL,
        backfill: vi.fn().mockResolvedValue(undefined),
      });
    },
  });
  subscriptions.push(observer.subscribe(() => {}));
  return {
    fold: () => observer.getCurrentResult().data,
    fetchCount: () => fetches,
  };
}

/**
 * Position guard, so moving the Set fails by name rather than as a mystery
 * timeout in the behavioural tests below.
 */
test('the deps Set sits at the index the invalidation predicate reads', () => {
  const key = surfaceHydrationQueryKey(CHANNEL);
  expect(key[1]).toBeInstanceOf(Set);
  expect([...(key[1] as Set<string>)].sort()).toEqual(['channels', 'posts']);
});

test('a post arriving re-folds a mounted board', async () => {
  await syncGroupFromShip(surfaceSpec({ sha256: HASH_A }));
  await db.insertChannelPosts({ posts: [invokePost(1)] });
  await settle();

  const board = mountBoard();
  await vi.waitFor(() => {
    expect(board.fold()?.state).toEqual({ log: [MEMBER] });
  });
  const fetchesAfterMount = board.fetchCount();

  // The write a live post arrival performs. Nothing re-renders the hook and
  // nothing refetches on an interval; the fold below happens only because
  // this write's `posts` effect overlaps the deps at queryKey[1].
  await db.insertChannelPosts({ posts: [invokePost(2)] });

  await vi.waitFor(() => {
    expect(board.fold()?.state).toEqual({ log: [MEMBER, MEMBER] });
  });
  expect(board.fetchCount()).toBeGreaterThan(fetchesAfterMount);
});

/**
 * D59's scenario, end to end: `insertGroups` is the write that carries channel
 * metadata on a boot or a full group sync, so it is what lands a republished
 * spec on a client that already holds the channel. Landing it in the database
 * is only half the job — under `staleTime: Infinity` the board keeps rendering
 * the superseded bundle unless this write also reaches the query.
 */
test('a group re-sync carrying a new spec re-folds a mounted board', async () => {
  await syncGroupFromShip(surfaceSpec({ sha256: HASH_A }));
  await db.insertChannelPosts({ posts: [invokePost(1)] });
  await settle();

  const board = mountBoard();
  await vi.waitFor(() => {
    expect(board.fold()?.spec?.bundle.sha256).toBe(HASH_A);
  });

  await syncGroupFromShip(surfaceSpec({ sha256: HASH_B }));

  await vi.waitFor(() => {
    expect(board.fold()?.spec?.bundle.sha256).toBe(HASH_B);
  });
});

/**
 * The complement, and the reason the deps are a Set of specific tables rather
 * than a marker: this predicate is global and runs on every write in the app.
 * A board that re-folded on unrelated traffic would re-page its whole history
 * every time a contact's profile arrived.
 */
test('an unrelated write leaves a mounted board alone', async () => {
  await syncGroupFromShip(surfaceSpec({ sha256: HASH_A }));
  await db.insertChannelPosts({ posts: [invokePost(1)] });
  await settle();

  const board = mountBoard();
  await vi.waitFor(() => {
    expect(board.fold()?.state).toEqual({ log: [MEMBER] });
  });
  const fetchesAfterMount = board.fetchCount();

  // `contacts`, `groups`, `contactGroups`, `contactAttestations` — no overlap
  await db.insertContacts([{ id: MEMBER } as db.Contact]);
  await settle();
  await settle();

  expect(board.fetchCount()).toBe(fetchesAfterMount);
  expect(
    queryClient.getQueryState(surfaceHydrationQueryKey(CHANNEL))?.isInvalidated
  ).toBe(false);
});
