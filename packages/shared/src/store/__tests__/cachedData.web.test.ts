import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as db from '../../db';
import { setupDatabaseTestSuite } from '../../test/helpers';
import { cacheContacts, loadCachedContacts } from '../cachedData.web';

const localStorageEntries = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageEntries.get(key) ?? null,
  setItem: (key: string, value: string) => {
    localStorageEntries.set(key, String(value));
  },
  removeItem: (key: string) => {
    localStorageEntries.delete(key);
  },
  clear: () => localStorageEntries.clear(),
});

const ship = '~bot';
const cachedClaim = JSON.stringify({
  v: 1,
  harness: 'openclaw',
  version: '0.19.0',
});
const liveClaim = JSON.stringify({
  v: 1,
  harness: 'openclaw',
  version: '0.20.0',
});

setupDatabaseTestSuite();

// The snapshot is written when bulk sync runs and never refreshed by the
// `/v1/news` facts that keep SQLite current, so on reload it is a *stale*
// source: it may only fill rows we are missing.
describe('loadCachedContacts', () => {
  beforeEach(() => {
    localStorageEntries.clear();
  });

  it('does not overwrite a row already in the database', async () => {
    await db.upsertContact({ id: ship, botInfo: liveClaim });
    cacheContacts([{ id: ship, botInfo: cachedClaim } as db.Contact]);

    expect(await loadCachedContacts()).toBe(true);

    expect((await db.getContact({ id: ship }))?.botInfo).toBe(liveClaim);
  });

  it('does not resurrect a claim the live row cleared', async () => {
    await db.upsertContact({ id: ship, botInfo: null });
    cacheContacts([{ id: ship, botInfo: cachedClaim } as db.Contact]);

    expect(await loadCachedContacts()).toBe(true);

    expect((await db.getContact({ id: ship }))?.botInfo).toBeNull();
  });

  it('inserts cached rows for ships the database does not know', async () => {
    cacheContacts([{ id: ship, botInfo: cachedClaim } as db.Contact]);

    expect(await loadCachedContacts()).toBe(true);

    expect((await db.getContact({ id: ship }))?.botInfo).toBe(cachedClaim);
  });
});
