import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { openCampaignStore } from './store.js';
import type { CampaignState } from './model.js';

it('persists owner opt-out and sent steps independently across restarts', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'tlon-campaign-'));
  let store = openCampaignStore(directory);
  const row: CampaignState = {
    owner: '~ten',
    version: 1,
    enrolledAt: Date.now(),
    status: 'active',
    timezone: 'Etc/UTC',
    sent: [{ step: 'useful-request', at: Date.now(), text: 'Hello' }],
    skipped: [],
  };
  try {
    await store.save(row);
    await store.save(row);
    // Owner updates cannot erase an accepted sent step.
    await store.save({ ...row, sent: [], status: 'opted-out' });
    store.close();
    store = openCampaignStore(directory);
    expect(await store.lookup('~ten')).toEqual({ ...row, status: 'opted-out' });
    expect(await store.lookup('~mug')).toBeUndefined();
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
