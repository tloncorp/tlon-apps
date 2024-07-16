import Database from 'better-sqlite3';
import { BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import tmp from 'tmp';
import { MockedFunction, beforeAll, beforeEach } from 'vitest';

import { scry } from '../api/urbit';
import { setClient } from '../db';
import { AnySqliteDatabase } from '../db/client';
import * as schema from '../db/schema';

let dbFile: tmp.FileResult | null = null;
let client: AnySqliteDatabase | null = null;

export function getClient() {
  return client;
}

export function setupDb() {
  resetDb();
}

export function resetDb() {
  if (dbFile) {
    dbFile.removeCallback();
  }
  dbFile = tmp.fileSync();
  const sqlite = new Database(dbFile.name);
  client = drizzle(sqlite, { schema }) as unknown as AnySqliteDatabase;
  setClient(client);
  migrate(client as unknown as BetterSQLite3Database, {
    migrationsFolder: __dirname + '/../db/migrations',
  });
}

/**
 * Sets up a test database before any test is run, then resets the database before each test.
 */
export function setupDatabaseTestSuite() {
  beforeAll(() => {
    setupDb();
  });

  beforeEach(async () => {
    resetDb();
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
