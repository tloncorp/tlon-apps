import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { openCampaignStore } from './store.js';
import type { CampaignState } from './model.js';

it('persists state and arbitrates competing claims across independent database connections', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'tlon-campaign-'));
  const first = openCampaignStore(directory);
  const second = openCampaignStore(directory);
  const row: CampaignState = {
    owner: '~ten',
    version: 1,
    enrolledAt: Date.now(),
    status: 'active',
    sent: [],
    skipped: [],
  };
  try {
    expect(
      await Promise.all([
        first.registerIfAbsent('~ten', row),
        second.registerIfAbsent('~ten', row),
      ])
    ).toEqual([true, false]);
    await second.register('~ten', { ...row, status: 'opted-out' });
    expect((await first.lookup('~ten'))?.status).toBe('opted-out');
    first.close();
    const restarted = openCampaignStore(directory);
    try {
      expect((await restarted.lookup('~ten'))?.status).toBe('opted-out');
    } finally {
      restarted.close();
    }
  } finally {
    second.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
