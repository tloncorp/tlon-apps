import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import tmp from 'tmp';

import { setClient } from '../db';
import { AnySqliteDatabase } from '../db/client';
import * as schema from '../db/schema';

let dbFile: tmp.FileResult | null = null;

export function setupDb() {
  resetDb();
}

export function resetDb() {
  if (dbFile) {
    dbFile.removeCallback();
  }
  dbFile = tmp.fileSync();
  const sqlite = new Database(dbFile.name);
  const db = drizzle(sqlite, { schema, logger: true });
  setClient(db as unknown as AnySqliteDatabase);
  migrate(db, {
    migrationsFolder: __dirname + '/../db/migrations',
  });
}
