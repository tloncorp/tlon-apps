import { afterEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchChangesSince: vi.fn(),
}));

vi.mock('@tloncorp/api/client/changesApi', () => ({
  fetchChangesSince: mocks.fetchChangesSince,
}));

import { useDebugStore } from '../../debug';
import { setupDatabaseTestSuite } from '../../test/helpers';
import { syncLatestChanges, syncSince } from './sync';

setupDatabaseTestSuite();

afterEach(() => {
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

  await syncSince({ since: Date.now(), callCtx: { cause: 'test' } });

  await vi.waitFor(() => {
    expect(capture).toHaveBeenCalledWith(
      'app_error',
      expect.objectContaining({
        cause: 'test',
        errorMessage: 'changes failed',
        errorTitle: 'sync since failed',
      })
    );
  });
  expect(
    capture.mock.calls.some(([event]) => event === 'synced latest changes')
  ).toBe(false);
});
