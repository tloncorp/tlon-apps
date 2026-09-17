import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sharedMap, sharedSlot } from '../../shared-state.js';
import type { CampaignState } from './model.js';

export type CampaignStore = {
  lookup(key: string): Promise<CampaignState | undefined>;
  register(key: string, value: CampaignState): Promise<void>;
  registerIfAbsent(key: string, value: CampaignState): Promise<boolean>;
};

// OpenClaw restricts runtime.state.openKeyedStore to bundled/official plugins.
// Tlon is also deployed as a local plugin, so own this small durable store in
// the same state directory. SQLite INSERT OR IGNORE provides cross-process claims.
export function openCampaignStore(stateDir: string) {
  const directory = path.join(stateDir, 'tlon');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'onboarding-campaign.sqlite');
  const database = new DatabaseSync(file);
  chmodSync(file, 0o600);
  database.exec(
    'PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS campaign_state (key TEXT PRIMARY KEY, value_json TEXT NOT NULL)'
  );
  const lookup = database.prepare(
    'SELECT value_json FROM campaign_state WHERE key=?'
  );
  const register = database.prepare(
    'INSERT INTO campaign_state(key,value_json) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json'
  );
  const claim = database.prepare(
    'INSERT OR IGNORE INTO campaign_state(key,value_json) VALUES (?,?)'
  );
  return {
    async lookup(key: string): Promise<CampaignState | undefined> {
      const row = lookup.get(key) as { value_json: string } | undefined;
      return row ? (JSON.parse(row.value_json) as CampaignState) : undefined;
    },
    async register(key: string, value: CampaignState) {
      register.run(key, JSON.stringify(value));
    },
    async registerIfAbsent(key: string, value: CampaignState) {
      return claim.run(key, JSON.stringify(value)).changes === 1;
    },
    close() {
      database.close();
    },
  };
}
const databases = sharedMap<string, ReturnType<typeof openCampaignStore>>(
  'onboardingCampaign.databases'
);
export function campaignStoreForDirectory(directory: string): CampaignStore {
  let store = databases.get(directory);
  if (!store) {
    store = openCampaignStore(directory);
    databases.set(directory, store);
  }
  return store;
}
const slot = sharedSlot<CampaignStore>('onboardingCampaign.store');
export const setCampaignStore = (store: CampaignStore | null) =>
  slot.set(store);
export const getCampaignStore = () => slot.get();
const writes = sharedMap<string, Promise<unknown>>('onboardingCampaign.writes');

export async function withCampaignLock<T>(
  owner: string,
  run: () => Promise<T>
): Promise<T> {
  const previous = writes.get(owner) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(run);
  writes.set(owner, current);
  try {
    return await current;
  } finally {
    if (writes.get(owner) === current) writes.delete(owner);
  }
}

export async function saveCampaign(store: CampaignStore, state: CampaignState) {
  // OpenClaw state rejects undefined even in optional fields.
  await store.register(
    state.owner,
    JSON.parse(JSON.stringify(state)) as CampaignState
  );
}
