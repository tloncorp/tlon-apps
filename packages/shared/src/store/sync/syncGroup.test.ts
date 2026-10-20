import * as api from '@tloncorp/api';
import { beforeEach, expect, test, vi } from 'vitest';

import * as db from '../../db';
import { syncGroup } from './syncGroup';

const { trackError } = vi.hoisted(() => ({ trackError: vi.fn() }));

vi.mock('@tloncorp/api', () => ({ getGroup: vi.fn() }));
vi.mock('../../db', () => ({ getGroup: vi.fn() }));
vi.mock('../../db/query', () => ({ batchEffects: vi.fn() }));
vi.mock('../session', () => ({
  getClientGeneration: () => 0,
  getSession: () => null,
}));
vi.mock('./updateLastActivityTime', () => ({
  updateLastActivityTime: vi.fn(),
}));
vi.mock('../../debug', () => ({
  createDevLogger: () => ({ log: vi.fn(), trackEvent: vi.fn(), trackError }),
  runIfDev: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(db.getGroup).mockResolvedValue(null);
});

test('an aborted group sync is not reported', async () => {
  let finishFetch!: () => void;
  vi.mocked(api.getGroup).mockReturnValue(
    new Promise((resolve) => {
      finishFetch = () =>
        resolve({} as Awaited<ReturnType<typeof api.getGroup>>);
    })
  );
  const controller = new AbortController();
  const sync = syncGroup('~zod/aborted', {
    priority: 0,
    abortSignal: controller.signal,
  });
  // The abort listener is only attached once the fetch reaches the queue.
  await vi.waitFor(() => expect(api.getGroup).toHaveBeenCalled());
  controller.abort();

  await expect(sync).rejects.toThrow('Operation aborted');
  expect(trackError).not.toHaveBeenCalled();
  expect(console.error).not.toHaveBeenCalled();
  finishFetch();
});

test('a failed group sync is still reported', async () => {
  const failure = new Error('fetch failed');
  vi.mocked(api.getGroup).mockRejectedValue(failure);

  await expect(syncGroup('~zod/failed')).rejects.toBe(failure);
  expect(trackError).toHaveBeenCalledTimes(1);
  expect(trackError).toHaveBeenCalledWith('group sync failed', failure);
});
