import * as api from '@tloncorp/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as db from '../db';
import { ensureContextLensRun, refreshContextLensRun } from './lensActions';

vi.mock('@tloncorp/api', () => ({
  getLensRun: vi.fn(),
}));

vi.mock('../db', () => ({
  getContextLensRun: vi.fn(),
  insertContextLensRuns: vi.fn(),
}));

const run = {
  botShip: '~bus',
  lensId: 'run-1',
  complete: false,
  receivedAt: 1,
  payload: {},
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Context Lens run hydration', () => {
  it('keeps ensure db-first when a local snapshot exists', async () => {
    vi.mocked(db.getContextLensRun).mockResolvedValue(run);

    await expect(
      ensureContextLensRun({ botShip: '~bus', lensId: 'run-1' })
    ).resolves.toBe(run);

    expect(api.getLensRun).not.toHaveBeenCalled();
    expect(db.insertContextLensRuns).not.toHaveBeenCalled();
  });

  it('force-refreshes and caches an exact run without consulting local state', async () => {
    const refreshed = { ...run, complete: true, receivedAt: 2 };
    vi.mocked(api.getLensRun).mockResolvedValue(refreshed);

    await expect(
      refreshContextLensRun({ botShip: '~bus', lensId: 'run-1' })
    ).resolves.toBe(refreshed);

    expect(db.getContextLensRun).not.toHaveBeenCalled();
    expect(api.getLensRun).toHaveBeenCalledWith('~bus', 'run-1');
    expect(db.insertContextLensRuns).toHaveBeenCalledWith([refreshed]);
  });
});
