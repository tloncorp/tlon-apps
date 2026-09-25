import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sharedMap, sharedSlot } from '../../shared-state.js';
import type { CampaignState } from './model.js';

export type CampaignStore = {
  lookup(owner: string): Promise<CampaignState | undefined>;
  save(state: CampaignState): Promise<void>;
};

// Local plugins cannot use OpenClaw's bundled-plugin keyed store.
export function openCampaignStore(stateDir: string) {
  const directory = path.join(stateDir, 'tlon');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'onboarding-campaign.sqlite');
  const database = new DatabaseSync(file);
  chmodSync(file, 0o600);
  database.exec(`
    PRAGMA busy_timeout=5000;
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS campaign_owner (
      owner TEXT PRIMARY KEY, version INTEGER NOT NULL, enrolledAt INTEGER NOT NULL,
      status TEXT NOT NULL, timezone TEXT, groupId TEXT, channelId TEXT, destination TEXT,
      topic TEXT, purpose TEXT, lastOwnerText TEXT, activityMinute INTEGER,
      lastReplyAt INTEGER, lastActivityAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS campaign_sent (
      owner TEXT NOT NULL, step TEXT NOT NULL, at INTEGER NOT NULL, text TEXT, destination TEXT,
      PRIMARY KEY(owner, step)
    );
    CREATE TABLE IF NOT EXISTS campaign_skipped (
      owner TEXT NOT NULL, step TEXT NOT NULL, reason TEXT NOT NULL, PRIMARY KEY(owner, step)
    );
  `);
  const columns = [
    'owner',
    'version',
    'enrolledAt',
    'status',
    'timezone',
    'groupId',
    'channelId',
    'destination',
    'topic',
    'purpose',
    'lastOwnerText',
    'activityMinute',
    'lastReplyAt',
    'lastActivityAt',
  ] as const;
  const owner =
    database.prepare(`INSERT INTO campaign_owner (${columns.join(',')})
    VALUES (${columns.map(() => '?').join(',')}) ON CONFLICT(owner) DO UPDATE SET
    ${columns
      .slice(1)
      .map((c) => `${c}=excluded.${c}`)
      .join(',')}`);
  const sent = database.prepare(
    'INSERT OR IGNORE INTO campaign_sent(owner,step,at,text,destination) VALUES (?,?,?,?,?)'
  );
  const skipped = database.prepare(
    'INSERT OR IGNORE INTO campaign_skipped(owner,step,reason) VALUES (?,?,?)'
  );
  const lookup = database.prepare('SELECT * FROM campaign_owner WHERE owner=?');
  const sentRows = database.prepare(
    'SELECT step,at,text,destination FROM campaign_sent WHERE owner=? ORDER BY at'
  );
  const skippedRows = database.prepare(
    'SELECT step,reason FROM campaign_skipped WHERE owner=?'
  );
  return {
    async lookup(key: string): Promise<CampaignState | undefined> {
      const row = lookup.get(key);
      if (!row) return undefined;
      const omitNull = (value: Record<string, unknown>) =>
        Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null));
      return {
        ...omitNull(row),
        sent: sentRows.all(key).map(omitNull),
        skipped: skippedRows.all(key),
      } as CampaignState;
    },
    async save(state: CampaignState) {
      database.exec('BEGIN');
      try {
        owner.run(...columns.map((c) => state[c] ?? null));
        for (const step of state.sent)
          sent.run(
            state.owner,
            step.step,
            step.at,
            step.text ?? null,
            step.destination ?? null
          );
        for (const step of state.skipped)
          skipped.run(state.owner, step.step, step.reason);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
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
