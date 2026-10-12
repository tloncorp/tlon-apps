import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getLensCronRuns } from '../client/lensApi';
import {
  DeskUnsupportedError,
  getDeskSupportsTaskRunsState,
  scry,
} from '../client/urbit';

vi.mock('../client/urbit', async (importOriginal) => {
  const original = await importOriginal<typeof import('../client/urbit')>();
  return {
    BadResponseError: original.BadResponseError,
    DeskUnsupportedError: original.DeskUnsupportedError,
    getDeskSupportsTaskRunsState: vi.fn(),
    scry: vi.fn(),
  };
});

const bot = '~rapsed-podlec-nocsyx-lassul';
const entry = {
  bot,
  id: 'lens-1',
  complete: true,
  received: '~2026.10.12..09.00.00',
  payload: { schemaVersion: 1, lens: { lensId: 'lens-1' } },
};

beforeEach(() => {
  vi.mocked(scry).mockReset();
  vi.mocked(getDeskSupportsTaskRunsState).mockReturnValue(true);
});

describe('getLensCronRuns', () => {
  test('reads the newest page of a task with its total', async () => {
    vi.mocked(scry).mockResolvedValue({ page: { total: 3, entries: [entry] } });

    const page = await getLensCronRuns({
      botShip: bot,
      jobId: 'job-1',
      count: 50,
    });

    expect(scry).toHaveBeenCalledWith({
      app: 'steward',
      path: `/v1/lens/cron/${bot}/job-1/50`,
    });
    expect(page.total).toBe(3);
    expect(page.runs).toEqual([
      expect.objectContaining({
        botShip: bot,
        lensId: 'lens-1',
        receivedAt: Date.UTC(2026, 9, 12, 9),
      }),
    ]);
  });

  test('pages back past a run, as the ship writes the time', async () => {
    vi.mocked(scry).mockResolvedValue({ page: { total: 3, entries: [] } });

    await getLensCronRuns({
      botShip: bot,
      jobId: 'job-1',
      count: 50,
      before: Date.UTC(2026, 9, 12, 9),
    });

    expect(scry).toHaveBeenCalledWith({
      app: 'steward',
      path: `/v1/lens/cron/${bot}/job-1/50/~2026.10.12..09.00.00`,
    });
  });

  test('is refused on a desk without task runs', async () => {
    vi.mocked(getDeskSupportsTaskRunsState).mockReturnValue(false);

    await expect(
      getLensCronRuns({ botShip: bot, jobId: 'job-1', count: 50 })
    ).rejects.toBeInstanceOf(DeskUnsupportedError);
    expect(scry).not.toHaveBeenCalled();
  });
});
