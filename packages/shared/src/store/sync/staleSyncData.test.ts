import { afterEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchChangesSince: vi.fn(),
}));

vi.mock('@tloncorp/api/client/changesApi', () => ({
  fetchChangesSince: mocks.fetchChangesSince,
}));

import { useDebugStore } from '../../debug';
import { setupDatabaseTestSuite } from '../../test/helpers';
import { StaleSyncDataError, syncSince } from './sync';

setupDatabaseTestSuite();

afterEach(() => {
  vi.restoreAllMocks();
  mocks.fetchChangesSince.mockReset();
  useDebugStore.getState().initializeErrorLogger({ capture: () => {} });
});

const emptyChanges = {
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
};

/**
 * Advances the clock the way an app suspension does: wall time jumps while the
 * fetch is in flight, so `syncLatestChanges` comes back holding stale data.
 */
function suspendDuringFetch(jumpMs: number) {
  const realNow = Date.now.bind(Date);
  let offsetMs = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offsetMs);
  mocks.fetchChangesSince.mockImplementation(async () => {
    offsetMs = jumpMs;
    return emptyChanges;
  });
  return realNow;
}

test('StaleSyncDataError keeps the reported elapsed time and message', () => {
  const error = new StaleSyncDataError(73_454_712);

  expect(error.runningForMs).toBe(73_454_712);
  expect(error.message).toBe(
    'discarded fetched data, had been running for 73454712ms'
  );
});

test('reports a suspension-stale sync as an event, not an error', async () => {
  const capture = vi.fn();
  useDebugStore.getState().initializeErrorLogger({ capture });
  const realNow = suspendDuringFetch(3 * 60 * 1000);

  await expect(
    syncSince({ since: realNow(), callCtx: { cause: 'test' } })
  ).resolves.toBe('error');

  await vi.waitFor(() => {
    expect(capture).toHaveBeenCalledWith(
      'sync since discarded stale data',
      expect.objectContaining({
        cause: 'test',
        sync: 'syncLatestChanges',
        runningForMs: expect.any(Number),
      })
    );
  });
  expect(capture.mock.calls.some(([event]) => event === 'app_error')).toBe(
    false
  );
});

test('still reports a genuine sync failure as an error', async () => {
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
    capture.mock.calls.some(
      ([event]) => event === 'sync since discarded stale data'
    )
  ).toBe(false);
});
