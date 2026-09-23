import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  ThreadViewSnapshot,
  compareThreadReplies,
  emitThreadDiagnostic,
  monitorThreadCatchup,
  recordThreadEvidence,
  recordThreadPostDeleted,
  recordThreadPostsReceived,
  replySummary,
} from './threadSyncTelemetry';

const capture = vi.hoisted(() => vi.fn());
vi.mock('../debug', () => ({
  createDevLogger: () => ({ trackEvent: capture }),
  addCustomEnabledLoggers: vi.fn(),
}));
const identity = { channelId: 'chat/~zod/test', postId: 'root' };
const reply = { id: 'reply' };
let view: ThreadViewSnapshot;
let database: { id: string; isDeleted?: boolean }[];
let active: boolean;
let emit: ReturnType<typeof vi.fn>;
let monitor: ReturnType<typeof monitorThreadCatchup>;

beforeEach(() => {
  vi.useFakeTimers();
  capture.mockReset();
  database = [];
  active = true;
  emit = vi.fn();
  view = {
    queryReplies: [],
    listReplies: [],
    includeDeleted: false,
    queryStatus: 'success',
    fetchStatus: 'idle',
    dataUpdatedAt: 1,
    errorUpdatedAt: 0,
  };
  monitor = monitorThreadCatchup(
    identity,
    async () => database,
    () => view,
    () => active,
    'focus',
    emit
  );
});
afterEach(() => {
  monitor.stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function receive(replies = [reply], overrides = {}) {
  recordThreadEvidence({
    ...identity,
    attemptId: 'fetch-1',
    source: 'thread_fetch',
    startedAt: Date.now(),
    replies,
    ...overrides,
  });
}
function outcomes(outcome: string) {
  return emit.mock.calls.filter(([, props]) => props.outcome === outcome);
}

test('fingerprints identity sets independent of order', () => {
  expect(replySummary([{ id: 'a' }, { id: 'b' }])).toEqual(
    replySummary([{ id: 'b' }, { id: 'a' }])
  );
  expect(replySummary([{ id: 'a' }]).fingerprint).not.toEqual(
    replySummary([{ id: 'b' }]).fingerprint
  );
});
test.each(['database', 'query', 'list'] as const)(
  'identifies a sustained %s gap and correlates recovery',
  async (stage) => {
    receive();
    if (stage !== 'database') database = [reply];
    if (stage === 'list') view.queryReplies = [reply];
    await vi.advanceTimersByTimeAsync(5000);
    expect(outcomes('mismatch')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(outcomes('mismatch')).toHaveLength(1);
    expect(outcomes('mismatch')[0][1]).toMatchObject({
      ...identity,
      attemptId: 'fetch-1',
      sustainedStages: [stage],
    });
    await vi.advanceTimersByTimeAsync(30000);
    expect(outcomes('mismatch')).toHaveLength(1);
    database = [reply];
    view.queryReplies = [reply];
    view.listReplies = [reply];
    monitor.update();
    await vi.advanceTimersByTimeAsync(100);
    expect(outcomes('recovered')[0][1].checkId).toBe(
      outcomes('mismatch')[0][1].checkId
    );
    expect(outcomes('recovered')[0][2]).toBe(true);
  }
);
test('allows async invalidation and distinguishes valid empty results', async () => {
  receive([]);
  await vi.advanceTimersByTimeAsync(100);
  expect(outcomes('caught_up')[0][1]).toMatchObject({
    source: 'thread_fetch',
    expected: { count: 0 },
    queryStatus: 'success',
  });
  receive();
  database = [reply];
  monitor.update();
  await vi.advanceTimersByTimeAsync(100);
  view.queryReplies = [reply];
  view.listReplies = [reply];
  monitor.update();
  await vi.advanceTimersByTimeAsync(5000);
  expect(outcomes('mismatch')).toHaveLength(0);
});
test('query failure with cached data is reported even when counts match', async () => {
  receive([]);
  view.queryStatus = 'error';
  view.errorUpdatedAt = Date.now();
  await vi.advanceTimersByTimeAsync(5100);
  expect(outcomes('mismatch')[0][1]).toMatchObject({
    sustainedStages: ['query_status'],
    queryStatus: 'error',
  });
});
test('excludes local sends, handles delete markers and allows concurrent extra replies', () => {
  const pending = { id: 'pending', deliveryStatus: 'pending' as const };
  const deleted = { id: 'deleted', isDeleted: true };
  expect(
    compareThreadReplies(
      [reply, deleted, pending],
      [reply, deleted, pending, { id: 'new' }],
      {
        ...view,
        queryReplies: [reply, { id: 'new' }],
        listReplies: [reply, { id: 'new' }],
      }
    )
  ).toEqual({ database: [], query: [], list: [] });
  expect(
    compareThreadReplies([], [deleted], { ...view, includeDeleted: true }).query
  ).toEqual(['deleted']);
});
test('a delete received during an older fetch is not resurrected as missing', async () => {
  const startedAt = Date.now();
  receive();
  await vi.advanceTimersByTimeAsync(100);
  recordThreadPostDeleted('reply');
  receive([reply], { startedAt });
  await vi.advanceTimersByTimeAsync(5000);
  expect(outcomes('mismatch')).toHaveLength(0);
});
test('late replies get their own grace period', async () => {
  receive();
  await vi.advanceTimersByTimeAsync(5000);
  database = [reply];
  view.queryReplies = [reply];
  view.listReplies = [reply];
  receive([{ id: 'later' }]);
  await vi.advanceTimersByTimeAsync(100);
  expect(outcomes('mismatch')).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(5000);
  expect(outcomes('mismatch')[0][1].missingDatabaseIds).toEqual(['later']);
});
test('reports a replacement gap after an earlier mismatch clears', async () => {
  receive();
  await vi.advanceTimersByTimeAsync(5100);
  expect(outcomes('mismatch')).toHaveLength(1);

  receive([{ id: 'later' }], {
    source: 'subscription',
    attemptId: 'live',
  });
  await vi.advanceTimersByTimeAsync(100);
  database = [reply];
  view.queryReplies = [reply];
  view.listReplies = [reply];
  monitor.update();
  await vi.advanceTimersByTimeAsync(100);

  expect(outcomes('mismatch')).toHaveLength(1);
  expect(outcomes('recovered')).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(5000);
  expect(outcomes('mismatch')).toHaveLength(2);
  expect(outcomes('mismatch')[1][1]).toMatchObject({
    source: 'subscription',
    missingDatabaseIds: ['later'],
  });
});
test.each(['subscription', 'changes'] as const)(
  'checks incoming %s replies after the initial thread settled',
  async (source) => {
    await vi.advanceTimersByTimeAsync(100);
    recordThreadPostsReceived(
      [
        {
          ...reply,
          type: 'reply',
          channelId: identity.channelId,
          parentId: identity.postId,
          authorId: '~zod',
          sentAt: 1,
          receivedAt: 1,
        },
      ],
      source
    );
    await vi.advanceTimersByTimeAsync(5100);
    expect(outcomes('mismatch')[0][1]).toMatchObject({
      source,
      missingDatabaseIds: ['reply'],
    });
  }
);
test('ignores unrelated threads and background does not report failure', async () => {
  receive([reply], { postId: 'different' });
  await vi.advanceTimersByTimeAsync(100);
  expect(outcomes('caught_up')[0][1].expected.count).toBe(0);
  receive();
  await vi.advanceTimersByTimeAsync(100);
  active = false;
  await vi.advanceTimersByTimeAsync(5000);
  monitor.stop();
  expect(outcomes('mismatch')).toHaveLength(0);
  expect(outcomes('interrupted')).toHaveLength(1);
});
test('discards late database results after unmount', async () => {
  monitor.stop();
  let resolve!: (rows: { id: string }[]) => void;
  monitor = monitorThreadCatchup(
    identity,
    () =>
      new Promise((r) => {
        resolve = r;
      }),
    () => view,
    () => active,
    'focus',
    emit
  );
  receive();
  await vi.advanceTimersByTimeAsync(100);
  monitor.stop();
  resolve([]);
  await vi.advanceTimersByTimeAsync(10000);
  expect(outcomes('mismatch')).toHaveLength(0);
  expect(outcomes('caught_up')).toHaveLength(0);
});
test('bounds ID samples while retaining total missing counts', async () => {
  receive(Array.from({ length: 30 }, (_, i) => ({ id: `reply-${i}` })));
  await vi.advanceTimersByTimeAsync(5100);
  expect(outcomes('mismatch')[0][1]).toMatchObject({
    missingDatabaseCount: 30,
  });
  expect(outcomes('mismatch')[0][1].missingDatabaseIds).toHaveLength(5);
});
test('samples successes, retains failures and tolerates a broken logger', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.9);
  emitThreadDiagnostic('event', { outcome: 'succeeded' });
  expect(capture).not.toHaveBeenCalled();
  emitThreadDiagnostic('event', { outcome: 'failed' }, true);
  expect(capture).toHaveBeenCalledOnce();
  capture.mockImplementation(() => {
    throw new Error('logger unavailable');
  });
  expect(() => emitThreadDiagnostic('event', {}, true)).not.toThrow();
});

test('out-of-order full fetches cannot replace newer evidence or erase a concurrent reply', async () => {
  const oldest = Date.now();
  await vi.advanceTimersByTimeAsync(10);
  const newer = Date.now();
  await vi.advanceTimersByTimeAsync(10);
  receive([{ id: 'newer' }], { startedAt: newer, attemptId: 'fetch-newer' });
  receive([{ id: 'live' }], { source: 'subscription', attemptId: 'live' });
  receive([{ id: 'old' }], { startedAt: oldest, attemptId: 'fetch-old' });
  await vi.advanceTimersByTimeAsync(5200);
  expect(outcomes('mismatch')[0][1].missingDatabaseIds.sort()).toEqual([
    'live',
    'newer',
  ]);
  expect(outcomes('mismatch')[0][1].missingDatabaseEvidence).toContainEqual({
    id: 'newer',
    attemptId: 'fetch-newer',
    source: 'thread_fetch',
  });
});

test('a newer full snapshot can drop an earlier reply absent from the server', async () => {
  receive();
  await vi.advanceTimersByTimeAsync(100);
  receive([], { attemptId: 'fetch-newer' });
  await vi.advanceTimersByTimeAsync(5000);
  expect(outcomes('mismatch')).toHaveLength(0);
});
