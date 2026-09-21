import { afterEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchChangesSince: vi.fn(),
}));

vi.mock('@tloncorp/api/client/changesApi', () => ({
  fetchChangesSince: mocks.fetchChangesSince,
}));

import * as db from '../../db';
import { useDebugStore } from '../../debug';
import { setupDatabaseTestSuite } from '../../test/helpers';
import {
  observeSyncSinceCompletion,
  syncLatestChanges,
  syncSince,
} from './sync';

setupDatabaseTestSuite();

afterEach(() => {
  vi.restoreAllMocks();
  mocks.fetchChangesSince.mockReset();
  useDebugStore.getState().initializeErrorLogger({ capture: () => {} });
});

test('records an advisory spin failure on a successful changes completion', async () => {
  const capture = vi.fn();
  useDebugStore.getState().initializeErrorLogger({ capture });
  mocks.fetchChangesSince.mockResolvedValue({
    groups: [],
    posts: [],
    contacts: [],
    deletedChannelIds: [],
    unreads: {
      channelUnreads: [],
      groupUnreads: [],
      threadActivity: [],
    },
    nodeBusyStatus: 'unknown',
    spinOutcome: 'failed',
    spinDurationMs: 42,
    spinErrorClass: 'transport',
  });

  await expect(
    syncLatestChanges({ since: Date.now(), callCtx: { cause: 'test' } })
  ).resolves.toMatchObject({ nodeBusyStatus: 'unknown' });

  expect(capture).toHaveBeenCalledWith(
    'synced latest changes',
    expect.objectContaining({
      cause: 'test',
      nodeBusyStatus: 'unknown',
      spinOutcome: 'failed',
      spinDurationMs: 42,
      spinErrorClass: 'transport',
    })
  );
  expect(capture.mock.calls.some(([event]) => event === 'app_error')).toBe(
    false
  );
});

test('preserves normal sync error reporting for a changes failure', async () => {
  const capture = vi.fn();
  useDebugStore.getState().initializeErrorLogger({ capture });
  mocks.fetchChangesSince.mockRejectedValue(new Error('changes failed'));

  await expect(
    syncSince({
      since: Date.now(),
      callCtx: { cause: 'test', taskExecutionId: 'task-1' },
    })
  ).resolves.toBe('error');

  await vi.waitFor(() => {
    expect(capture).toHaveBeenCalledWith(
      'app_error',
      expect.objectContaining({
        cause: 'test',
        errorMessage: 'changes failed',
        errorTitle: 'sync since failed',
        taskExecutionId: 'task-1',
      })
    );
  });
  expect(
    capture.mock.calls.some(([event]) => event === 'synced latest changes')
  ).toBe(false);
});

test('returns success and the same completion outcome when changes sync succeeds', async () => {
  vi.spyOn(db.headsSyncedAt, 'getValue').mockResolvedValue(Date.now());
  mocks.fetchChangesSince.mockResolvedValue({
    groups: [],
    posts: [],
    contacts: [],
    deletedChannelIds: [],
    unreads: { channelUnreads: [], groupUnreads: [], threadActivity: [] },
    nodeBusyStatus: 'unknown',
  });
  const completed = vi.fn();
  const unsubscribe = observeSyncSinceCompletion(completed);
  try {
    expect(await syncSince({ since: Date.now() })).toBe('success');
    expect(completed).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'success' })
    );
  } finally {
    unsubscribe();
  }
});

test('a failed initial latest-post fetch makes an otherwise successful changes sync fail', async () => {
  vi.spyOn(db.headsSyncedAt, 'getValue').mockResolvedValue(0);
  const setHeadsSyncedAt = vi.spyOn(db.headsSyncedAt, 'setValue');
  mocks.fetchChangesSince.mockResolvedValue({
    groups: [],
    posts: [],
    contacts: [],
    deletedChannelIds: [],
    unreads: { channelUnreads: [], groupUnreads: [], threadActivity: [] },
    nodeBusyStatus: 'unknown',
  });
  const { scry } = await import('@tloncorp/api');
  vi.mocked(scry).mockRejectedValueOnce(new Error('latest posts unavailable'));
  expect(await syncSince({ since: Date.now() })).toBe('error');
  expect(setHeadsSyncedAt).not.toHaveBeenCalled();
});

test('an aborted in-flight sync returns error to its caller and completion observer', async () => {
  const controller = new AbortController();
  let started!: () => void;
  const didStart = new Promise<void>((resolve) => {
    started = resolve;
  });
  let finish!: (value: unknown) => void;
  mocks.fetchChangesSince.mockImplementation(() => {
    started();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const completed = vi.fn();
  const unsubscribe = observeSyncSinceCompletion(completed);
  try {
    const pending = syncSince({
      since: Date.now(),
      syncCtx: { priority: 10, abortSignal: controller.signal },
    });
    await didStart;
    controller.abort();
    expect(await pending).toBe('error');
    expect(completed).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'error' })
    );
  } finally {
    finish({});
    unsubscribe();
  }
});

test('a failed stale-cursor init fallback returns error', async () => {
  const { scry } = await import('@tloncorp/api');
  vi.mocked(scry).mockRejectedValueOnce(new Error('init unavailable'));
  expect(await syncSince({ since: Date.now() - 4 * 24 * 60 * 60 * 1000 })).toBe(
    'error'
  );
});
