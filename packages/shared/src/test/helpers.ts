import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import tmp from 'tmp';
import { MockedFunction } from 'vitest';

import { scry } from '../api/urbit';
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
  const db = drizzle(sqlite, { schema });
  setClient(db as unknown as AnySqliteDatabase);
  migrate(db, {
    migrationsFolder: __dirname + '/../db/migrations',
  });
}

export function setScryOutput<T>(output: T) {
  (scry as MockedFunction<() => Promise<T>>).mockImplementationOnce(
    async () => output
  );
}

export function setScryOutputs<T>(outputs: T[]) {
  (scry as MockedFunction<() => Promise<T>>).mockImplementation(
    async () => outputs.shift()!
  );
}
