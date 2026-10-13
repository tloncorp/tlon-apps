import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as api from '@tloncorp/api';
import * as db from '../../db';
import {
  emitThreadDiagnostic,
  recordThreadEvidence,
} from '../threadSyncTelemetry';
import { QueueClearedError, syncQueue } from '../syncQueue';
import { syncThreadPosts } from './syncThreadPosts';

vi.mock('@tloncorp/api', () => ({ getPostWithReplies: vi.fn() }));
vi.mock('../../db', () => ({
  insertChannelPosts: vi.fn(),
  getThreadPostDiagnostics: vi.fn(),
}));
vi.mock('../threadSyncTelemetry', async (original) => ({
  ...(await original<typeof import('../threadSyncTelemetry')>()),
  emitThreadDiagnostic: vi.fn(),
  recordThreadEvidence: vi.fn(),
}));
vi.mock('./updateLastActivityTime', () => ({
  updateLastActivityTime: vi.fn(),
}));
vi.mock('../../debug', () => ({
  createDevLogger: () => ({ log: vi.fn(), trackEvent: vi.fn() }),
  addCustomEnabledLoggers: vi.fn(),
}));
vi.mock('../syncQueue', () => ({
  QueueClearedError: class extends Error {},
  syncQueue: { add: vi.fn((_name, _ctx, action) => action()) },
}));
const options = {
  channelId: 'chat/~zod/test',
  postId: 'root',
  authorId: '~zod',
  trigger: 'missing_parent' as const,
};
const reply = {
  id: 'reply',
  type: 'reply' as const,
  parentId: 'root',
  channelId: options.channelId,
  authorId: '~zod',
  sentAt: 1,
  receivedAt: 1,
};
const root = {
  ...reply,
  id: 'root',
  parentId: null,
  type: 'chat' as const,
  replies: [reply],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getPostWithReplies).mockImplementation(
    async ({ onResponse }) => {
      onResponse?.();
      return root;
    }
  );
  vi.mocked(db.insertChannelPosts).mockResolvedValue(undefined);
  vi.mocked(db.getThreadPostDiagnostics).mockResolvedValue([
    { id: 'reply', isDeleted: null, deliveryStatus: null },
  ]);
});
function outcome() {
  return vi.mocked(emitThreadDiagnostic).mock.calls.at(-1)!;
}
test('correlates the fetch, database readback and active-thread evidence', async () => {
  await syncThreadPosts(options);
  expect(db.insertChannelPosts).toHaveBeenCalledWith({ posts: [root, reply] });
  expect(db.getThreadPostDiagnostics).toHaveBeenCalledWith({
    parentId: 'root',
  });
  expect(outcome()[1]).toMatchObject({
    outcome: 'succeeded',
    trigger: 'missing_parent',
    server: { count: 1 },
    database: { count: 1 },
    databaseCheck: 'matched',
  });
  const evidence = vi.mocked(recordThreadEvidence).mock.calls[0][0];
  expect(outcome()[1].attemptId).toBe(
    'attemptId' in evidence && evidence.attemptId
  );
});
test('a valid empty response is a successful fetch', async () => {
  vi.mocked(api.getPostWithReplies).mockImplementation(
    async ({ onResponse }) => {
      onResponse?.();
      return { ...root, replies: [] };
    }
  );
  vi.mocked(db.getThreadPostDiagnostics).mockResolvedValue([]);
  await syncThreadPosts(options);
  expect(outcome()[1]).toMatchObject({
    outcome: 'succeeded',
    responseReceived: true,
    server: { count: 0 },
    databaseCheck: 'matched',
  });
});
test.each(['request', 'normalization', 'database_write'] as const)(
  'records %s failure without swallowing the original rejection',
  async (stage) => {
    const error = new Error('private response body must not be captured');
    if (stage === 'database_write')
      vi.mocked(db.insertChannelPosts).mockRejectedValueOnce(error);
    else
      vi.mocked(api.getPostWithReplies).mockImplementationOnce(
        async ({ onResponse }) => {
          if (stage === 'normalization') onResponse?.();
          throw error;
        }
      );
    await expect(syncThreadPosts(options)).rejects.toBe(error);
    expect(outcome()[1]).toMatchObject({
      outcome: 'failed',
      failureStage: stage,
      responseReceived: stage !== 'request',
    });
    expect(outcome()[2]).toBe(true);
    expect(JSON.stringify(outcome())).not.toContain(error.message);
  }
);
test('queue cancellation is an interruption', async () => {
  vi.mocked(syncQueue.add).mockRejectedValueOnce(
    new QueueClearedError('cleared')
  );
  await expect(syncThreadPosts(options)).rejects.toThrow('cleared');
  expect(outcome()[1]).toMatchObject({
    outcome: 'interrupted',
    failureStage: 'queue',
  });
});
test('retains successful fetches with missing rows regardless of sampling', async () => {
  vi.mocked(db.getThreadPostDiagnostics).mockResolvedValueOnce([]);
  await syncThreadPosts(options);
  expect(outcome()[1]).toMatchObject({
    outcome: 'succeeded',
    databaseCheck: 'missing_rows',
    missingDatabaseIds: ['reply'],
  });
  expect(outcome()[2]).toBe(true);
});
test('diagnostic read failure does not fail a successful sync', async () => {
  vi.mocked(db.getThreadPostDiagnostics).mockRejectedValueOnce(
    new Error('read failed')
  );
  await expect(syncThreadPosts(options)).resolves.toBeUndefined();
  expect(outcome()[1]).toMatchObject({
    outcome: 'succeeded',
    databaseCheck: 'read_failed',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('separates initial queue wait from retries and the final request duration', async () => {
  let now = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.mocked(syncQueue.add).mockImplementationOnce(
    async (_label, _ctx, action) => {
      now = 10;
      try {
        await action();
      } catch {
        /* emulate queue retry */
      }
      now = 30;
      return action();
    }
  );
  vi.mocked(api.getPostWithReplies)
    .mockImplementationOnce(async () => {
      now = 15;
      throw new Error('retry');
    })
    .mockImplementationOnce(async ({ onResponse }) => {
      now = 40;
      onResponse?.();
      return root;
    });
  await syncThreadPosts(options, { priority: 5, retry: true });
  expect(outcome()[1]).toMatchObject({
    outcome: 'succeeded',
    queueMs: 10,
    requestMs: 10,
    requestCount: 2,
    startedAt: 0,
  });
});
