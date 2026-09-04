import { expect, test, vi } from 'vitest';

import * as db from '../../db';
import { resetDb, setupDatabaseTestSuite } from '../../test/helpers';
import { hydrateSurface } from './hydration';

setupDatabaseTestSuite();

const HOST = '~zod';
const MEMBER = '~ten';
const CHANNEL = 'chat/~zod/dashboard';
const SURFACE = 'srf-dash';

function spec(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    surfaceId: SURFACE,
    specRevision: 1,
    bundle: {
      assetRef: 'https://storage.example/b',
      sha256: 'a'.repeat(64),
      size: 512,
      shellVersion: 1,
    },
    initialState: { votes: {}, log: [] },
    actions: {
      vote: {
        ops: [{ op: 'set', path: '/votes/$actor', value: 'yes' }],
        acceptStale: true,
      },
      'log-entry': {
        ops: [{ op: 'append', path: '/log', value: '$actor' }],
      },
    },
    ...overrides,
  };
}

async function insertSurfaceChannel(
  specValue: unknown,
  { lastPostSequenceNum = 0 }: { lastPostSequenceNum?: number } = {}
) {
  await db.insertChannels([
    {
      id: CHANNEL,
      type: 'chat',
      title: 'Dash',
      surfaceSpec: specValue == null ? null : JSON.stringify(specValue),
      lastPostSequenceNum,
    },
  ]);
}

function invokeEntry(actionId: string, specRevision = 1) {
  return {
    type: 'surface-event',
    version: 1,
    surfaceId: SURFACE,
    specRevision,
    mode: 'invoke',
    actionId,
  };
}

function snapshotEntry(
  state: Record<string, unknown>,
  upToSequenceNum: number,
  specRevision = 1
) {
  return {
    type: 'surface-snapshot',
    version: 1,
    surfaceId: SURFACE,
    specRevision,
    upToSequenceNum,
    state,
  };
}

function makePost(
  sequenceNum: number,
  authorId: string,
  entries: unknown[],
  overrides: Partial<db.Post> = {}
): db.Post {
  return {
    id: `post-${sequenceNum}`,
    type: 'chat',
    channelId: CHANNEL,
    authorId,
    sentAt: sequenceNum * 1000,
    receivedAt: sequenceNum * 1000,
    sequenceNum,
    blob: JSON.stringify(entries),
    syncedAt: 0,
    ...overrides,
  } as db.Post;
}

async function insertPosts(posts: db.Post[]) {
  await db.insertChannelPosts({ posts });
  await db.updateChannel({
    id: CHANNEL,
    lastPostSequenceNum: Math.max(
      ...posts.map((post) => post.sequenceNum ?? 0)
    ),
  });
}

function noopBackfill() {
  const fn = vi.fn().mockResolvedValue(undefined);
  return fn;
}

test('spec-read results surface as distinct statuses', async () => {
  await insertSurfaceChannel(null);
  expect((await hydrateSurface({ channelId: CHANNEL })).status).toBe('absent');

  await db.updateChannel({ id: CHANNEL, surfaceSpec: '{"version":1}' });
  expect((await hydrateSurface({ channelId: CHANNEL })).status).toBe('invalid');

  await db.updateChannel({
    id: CHANNEL,
    surfaceSpec: JSON.stringify({ version: 99, whatever: true }),
  });
  const tooNew = await hydrateSurface({ channelId: CHANNEL });
  expect(tooNew.status).toBe('version-too-new');
  expect(tooNew.specVersion).toBe(99);
});

test('an empty channel hydrates from initialState', async () => {
  await insertSurfaceChannel(spec(), { lastPostSequenceNum: 0 });
  const result = await hydrateSurface({ channelId: CHANNEL });
  expect(result.status).toBe('hydrated');
  expect(result.state).toEqual({ votes: {}, log: [] });
});

test('cold start without a snapshot pages back to sequence 1', async () => {
  await insertSurfaceChannel(spec());
  const posts = Array.from({ length: 120 }, (_, i) =>
    makePost(i + 1, MEMBER, [invokeEntry('log-entry')])
  );
  await insertPosts(posts);

  const backfill = noopBackfill();
  const result = await hydrateSurface({
    channelId: CHANNEL,
    pageSize: 50,
    backfill,
  });
  expect(result.status).toBe('hydrated');
  expect((result.state!.log as unknown[]).length).toBe(120);
  expect(result.oldestLoadedSeq).toBe(1);
  // everything was local; the network was never touched
  expect(backfill).not.toHaveBeenCalled();
});

test('cold start with a snapshot stops at the boundary', async () => {
  await insertSurfaceChannel(spec());
  const events = Array.from({ length: 80 }, (_, i) =>
    makePost(i + 1, MEMBER, [invokeEntry('log-entry')])
  );
  const snap = makePost(81, HOST, [
    snapshotEntry({ votes: {}, log: ['snapshotted'] }, 60),
  ]);
  await insertPosts([...events, snap]);

  const result = await hydrateSurface({
    channelId: CHANNEL,
    pageSize: 50,
    backfill: noopBackfill(),
  });
  expect(result.status).toBe('hydrated');
  expect(result.reduction?.baseSnapshotSeq).toBe(60);
  // snapshot state plus only the events above the boundary (61..80)
  expect((result.state!.log as unknown[]).length).toBe(1 + 20);
  // never paged to channel start: the newest window already covered
  expect(result.oldestLoadedSeq).toBeGreaterThan(1);
});

test('deleting the snapshot mid-session falls back and refolds', async () => {
  await insertSurfaceChannel(spec());
  const events = Array.from({ length: 80 }, (_, i) =>
    makePost(i + 1, MEMBER, [invokeEntry('log-entry')])
  );
  const snap = makePost(81, HOST, [
    snapshotEntry({ votes: {}, log: ['snapshotted'] }, 60),
  ]);
  await insertPosts([...events, snap]);

  const before = await hydrateSurface({ channelId: CHANNEL, pageSize: 50 });
  expect(before.reduction?.baseSnapshotSeq).toBe(60);

  await db.markPostAsDeleted('post-81');
  const after = await hydrateSurface({ channelId: CHANNEL, pageSize: 50 });
  expect(after.status).toBe('hydrated');
  expect(after.reduction?.baseSnapshotSeq).toBeNull();
  // refolded from initialState over the full live post set
  expect((after.state!.log as unknown[]).length).toBe(80);
  expect(after.oldestLoadedSeq).toBe(1);
});

test('deletions below the boundary change nothing; above, they refold', async () => {
  await insertSurfaceChannel(spec());
  const events = Array.from({ length: 10 }, (_, i) =>
    makePost(i + 1, MEMBER, [invokeEntry('log-entry')])
  );
  const snap = makePost(11, HOST, [
    snapshotEntry({ votes: {}, log: ['a', 'b', 'c', 'd', 'e', 'f'] }, 6),
  ]);
  await insertPosts([...events, snap]);

  const base = await hydrateSurface({ channelId: CHANNEL });
  // snapshot state (6 entries) + events 7..10
  expect((base.state!.log as unknown[]).length).toBe(10);

  // below the boundary: frozen into the snapshot, nothing changes
  await db.markPostAsDeleted('post-3');
  const afterBelow = await hydrateSurface({ channelId: CHANNEL });
  expect(afterBelow.state).toEqual(base.state);

  // above the boundary: the live post set governs
  await db.markPostAsDeleted('post-8');
  const afterAbove = await hydrateSurface({ channelId: CHANNEL });
  expect((afterAbove.state!.log as unknown[]).length).toBe(9);
});

test('a non-preserving revision transition resets cleanly', async () => {
  await insertSurfaceChannel(spec());
  await insertPosts([
    makePost(1, MEMBER, [invokeEntry('log-entry', 1)]),
    makePost(2, MEMBER, [invokeEntry('vote', 1)]),
  ]);
  const beforeTransition = await hydrateSurface({ channelId: CHANNEL });
  expect((beforeTransition.state!.log as unknown[]).length).toBe(1);

  // admin publishes revision 2 without preserveState
  await db.updateChannel({
    id: CHANNEL,
    surfaceSpec: JSON.stringify(spec({ specRevision: 2 })),
  });
  const after = await hydrateSurface({ channelId: CHANNEL });
  expect(after.status).toBe('hydrated');
  // no prior-revision replay for the append; the acceptStale vote resolves
  // against the CURRENT action
  expect((after.state!.log as unknown[]).length).toBe(0);
  expect(after.state!.votes).toEqual({ [MEMBER]: 'yes' });
});

test('a preserving revision transition is migration-pending until the host snapshot lands', async () => {
  await insertSurfaceChannel(spec());
  await insertPosts([makePost(1, MEMBER, [invokeEntry('log-entry', 1)])]);

  await db.updateChannel({
    id: CHANNEL,
    surfaceSpec: JSON.stringify(spec({ specRevision: 2, preserveState: true })),
  });
  const pending = await hydrateSurface({ channelId: CHANNEL });
  expect(pending.status).toBe('migration-pending');

  // the host posts the migration snapshot at exactly revision 2
  await insertPosts([
    makePost(2, HOST, [snapshotEntry({ votes: {}, log: ['migrated'] }, 1, 2)]),
  ]);
  const migrated = await hydrateSurface({ channelId: CHANNEL });
  expect(migrated.status).toBe('hydrated');
  expect(migrated.state!.log).toEqual(['migrated']);

  // deleting the migration snapshot returns to migration-pending
  await db.markPostAsDeleted('post-2');
  const reverted = await hydrateSurface({ channelId: CHANNEL });
  expect(reverted.status).toBe('migration-pending');
});

test('live post arrivals fold incrementally on re-hydration', async () => {
  await insertSurfaceChannel(spec());
  await insertPosts([makePost(1, MEMBER, [invokeEntry('vote')])]);
  const first = await hydrateSurface({ channelId: CHANNEL });
  expect(first.state!.votes).toEqual({ [MEMBER]: 'yes' });

  await insertPosts([makePost(2, '~bus', [invokeEntry('vote')])]);
  const second = await hydrateSurface({ channelId: CHANNEL });
  expect(second.state!.votes).toEqual({ [MEMBER]: 'yes', '~bus': 'yes' });
  expect(second.reduction?.newestFoldedSeq).toBe(2);
});

test('a local window that cannot reach coverage reports partial, not state', async () => {
  await insertSurfaceChannel(spec());
  // only posts 61..80 are local; 1..60 were never synced
  const posts = Array.from({ length: 20 }, (_, i) =>
    makePost(i + 61, MEMBER, [invokeEntry('log-entry')])
  );
  await insertPosts(posts);

  const backfill = noopBackfill();
  const result = await hydrateSurface({ channelId: CHANNEL, backfill });
  expect(result.status).toBe('partial');
  expect(result.state).toBeUndefined();
  // it did ask the network for the missing range
  expect(backfill).toHaveBeenCalled();
});

test('a channel whose metadata is ahead of its posts reports partial', async () => {
  await insertSurfaceChannel(spec());
  // contiguous local history 1..50, so the OLDEST end is fully covered
  await insertPosts(
    Array.from({ length: 50 }, (_, i) =>
      makePost(i + 1, MEMBER, [invokeEntry('log-entry')])
    )
  );
  // but the server has advertised sequence 100: 51..100 never synced here,
  // and another client is already showing their effects
  await db.setLatestChannelSequenceNum({
    channelId: CHANNEL,
    sequenceNum: 100,
  });

  const backfill = noopBackfill();
  const result = await hydrateSurface({ channelId: CHANNEL, backfill });

  expect(result.status).toBe('partial');
  // a truncated fold carries no state at all — not even an empty one (§6)
  expect('state' in result).toBe(false);
  expect('reduction' in result).toBe(false);
  expect('stateFull' in result).toBe(false);
  // it tried the newest end before giving up
  expect(backfill).toHaveBeenCalledWith(
    expect.objectContaining({ channelId: CHANNEL, mode: 'newest' })
  );
});

test('a late response carrying a stale head cannot turn a partial fold into a hydrated one', async () => {
  await insertSurfaceChannel(spec());
  // the same 1..50 window as above
  await insertPosts(
    Array.from({ length: 50 }, (_, i) =>
      makePost(i + 1, MEMBER, [invokeEntry('log-entry')])
    )
  );
  await db.setLatestChannelSequenceNum({
    channelId: CHANNEL,
    sequenceNum: 100,
  });

  // An older-range request that observed head 50 completes last. If it were
  // allowed to lower the watermark, `reachesHead` would compare 50 >= 50 and
  // hand the renderer a fold over half the history as if it were current.
  await db.setLatestChannelSequenceNum({
    channelId: CHANNEL,
    sequenceNum: 50,
  });

  const result = await hydrateSurface({
    channelId: CHANNEL,
    backfill: noopBackfill(),
  });

  expect(result.status).toBe('partial');
  expect('state' in result).toBe(false);
  expect('reduction' in result).toBe(false);
});

test('the same channel hydrates once its posts catch up to the head', async () => {
  await insertSurfaceChannel(spec());
  await insertPosts(
    Array.from({ length: 50 }, (_, i) =>
      makePost(i + 1, MEMBER, [invokeEntry('log-entry')])
    )
  );
  await db.setLatestChannelSequenceNum({
    channelId: CHANNEL,
    sequenceNum: 100,
  });
  const behind = await hydrateSurface({
    channelId: CHANNEL,
    backfill: noopBackfill(),
  });
  expect(behind.status).toBe('partial');

  // 51..100 land
  await insertPosts(
    Array.from({ length: 50 }, (_, i) =>
      makePost(i + 51, MEMBER, [invokeEntry('log-entry')])
    )
  );

  const caughtUp = await hydrateSurface({
    channelId: CHANNEL,
    backfill: noopBackfill(),
  });
  expect(caughtUp.status).toBe('hydrated');
  expect((caughtUp.state!.log as unknown[]).length).toBe(100);
  expect(caughtUp.oldestLoadedSeq).toBe(1);
  expect(caughtUp.newestLoadedSeq).toBe(100);
});

test('a head post that folds no event still counts as coverage', async () => {
  await insertSurfaceChannel(spec());
  await insertPosts([
    makePost(1, MEMBER, [invokeEntry('vote')]),
    // an ordinary chat message at the head: nothing for the reducer to fold,
    // so the newest FOLDED sequence stays at 1 while the head is 2
    makePost(2, MEMBER, [], { blob: null }),
  ]);

  const result = await hydrateSurface({
    channelId: CHANNEL,
    backfill: noopBackfill(),
  });
  expect(result.status).toBe('hydrated');
  expect(result.state!.votes).toEqual({ [MEMBER]: 'yes' });
  expect(result.reduction?.newestFoldedSeq).toBe(1);
  expect(result.newestLoadedSeq).toBe(2);
});

test('a channel with no synced head withholds state rather than guess', async () => {
  await insertSurfaceChannel(spec());
  await insertPosts(
    Array.from({ length: 5 }, (_, i) =>
      makePost(i + 1, MEMBER, [invokeEntry('log-entry')])
    )
  );
  // no head watermark was ever recorded for this channel
  await db.updateChannel({ id: CHANNEL, lastPostSequenceNum: null });

  const result = await hydrateSurface({
    channelId: CHANNEL,
    backfill: noopBackfill(),
  });
  expect(result.status).toBe('partial');
  expect('state' in result).toBe(false);
});

// D187. Two posts can share a sequence number: there is no unique index on
// `(channelId, sequenceNum)` in the schema, and `channel-utils.hoon` ships a
// repairer for "duplicate sequence nrs in the posts". The pair therefore has
// to survive BOTH halves of the read path — the contiguity walk (which used
// to read the repeat as a gap) and the page cursor (which used to be a bare
// `sequenceNum < N` and stepped over the sibling the previous page's limit
// cut off) — or the reducer breaks a tie it can only see one side of, and two
// clients holding the same posts in different SQLite insertion order fold
// different state.
const TIE_LOW_ID = '170.141.184.506.257.000.000.000.000.000.000.001';
const TIE_HIGH_ID = '170.141.184.506.257.000.000.000.000.000.000.002';
const TIE_BASE_ID = '170.141.184.506.256.000.000.000.000.000.000.001';

function conflictSpec() {
  return spec({
    initialState: { x: 0, log: [] },
    actions: {
      // both write /x, so only one of them can be the final value: the fold
      // is wrong, not merely incomplete, if the losing row never arrives
      'x-low': {
        ops: [
          { op: 'set', path: '/x', value: 1 },
          { op: 'append', path: '/log', value: 'low' },
        ],
      },
      'x-high': {
        ops: [
          { op: 'set', path: '/x', value: 2 },
          { op: 'append', path: '/log', value: 'high' },
        ],
      },
    },
  });
}

/**
 * Rebuilds the database from scratch and inserts the posts one statement at a
 * time, so the tied pair's rowid order — the thing a client has no control
 * over and the thing the fold must not depend on — is exactly `tiedOrder`.
 */
async function seedTiedChannel(tiedOrder: db.Post[]) {
  resetDb();
  await insertSurfaceChannel(conflictSpec());
  const base = makePost(1, MEMBER, [], { id: TIE_BASE_ID, blob: null });
  for (const post of [base, ...tiedOrder]) {
    await db.insertChannelPosts({ posts: [post] });
  }
  await db.updateChannel({ id: CHANNEL, lastPostSequenceNum: 2 });
}

test('a sequence-number tie folds identically in either insertion order', async () => {
  const low = makePost(2, MEMBER, [invokeEntry('x-low')], { id: TIE_LOW_ID });
  const high = makePost(2, '~bus', [invokeEntry('x-high')], {
    id: TIE_HIGH_ID,
  });

  // Both rows reach the reducer, and the canonically greater id wins /x.
  const expected = { x: 2, log: ['low', 'high'] };

  const arrangements: [string, db.Post[]][] = [
    ['low-first', [low, high]],
    ['high-first', [high, low]],
  ];
  // pageSize 1 splits the tie ACROSS a page boundary — the half the tuple
  // cursor fixes. pageSize 50 keeps both rows inside one page — the half the
  // contiguity walk fixes.
  const pageSizes = [1, 50];

  const outcomes: unknown[] = [];
  for (const pageSize of pageSizes) {
    for (const [order, tiedOrder] of arrangements) {
      await seedTiedChannel(tiedOrder);
      const result = await hydrateSurface({
        channelId: CHANNEL,
        pageSize,
        backfill: noopBackfill(),
      });
      outcomes.push({
        pageSize,
        order,
        status: result.status,
        state: result.state,
      });
    }
  }

  expect(outcomes).toEqual(
    pageSizes.flatMap((pageSize) =>
      arrangements.map(([order]) => ({
        pageSize,
        order,
        status: 'hydrated',
        state: expected,
      }))
    )
  );
});
