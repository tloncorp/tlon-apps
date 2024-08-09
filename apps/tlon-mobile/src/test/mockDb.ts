import Database from 'better-sqlite3';
import { DrizzleConfig } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { Schema } from 'packages/shared/dist/db';
import { AnySqliteDatabase } from 'packages/shared/dist/db/client';

import { SQLiteConnection } from '../lib/sqliteConnection';

export class BetterSqlite3$SQLiteConnection implements SQLiteConnection {
  constructor(private connection: Database.Database) {}

  execute(query: string): void {
    this.connection.exec(query);
  }

  updateHook(
    _callback:
      | ((params: {
          table: string;
          operation: 'INSERT' | 'DELETE' | 'UPDATE';
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          row?: any;
          rowId: number;
        }) => void)
      | null
  ): void {
    // TODO
    // https://github.com/WiseLibs/better-sqlite3/issues/62#issuecomment-325797335
    throw new Error('Not implemented');
  }

  getDbPath(): string {
    return this.connection.name;
  }

  close(): void {
    this.connection.close();
  }

  delete(): void {
    throw new Error('Not implemented');
  }

  migrateClient(_client: AnySqliteDatabase): Promise<void> {
    throw new Error('Not implemented');
  }

  createClient(opts: DrizzleConfig<Schema>): AnySqliteDatabase {
    // `AnySqliteDatabase` does not accept `TMode = 'sync'`
    // https://github.com/tloncorp/tlon-apps/blob/ab95618a6813fcafc3db3c45a7a54f69c4c9522b/packages/shared/src/db/client.ts#L7-L8
    return drizzle(this.connection, opts) as unknown as AnySqliteDatabase;
  }
}

// Mock OPSQLite modules to use better-sqlite3 instead.
// The mocked members is a little dependent on the implementation
// of `nativeDb.ts`.
jest.mock('@op-engineering/op-sqlite', () => {
  const Database = require('better-sqlite3');
  return {
    open: ({ name }: { name: string }) => new Database(name),
  };
});
jest.mock('../lib/opsqliteConnection', () => {
  return {
    OPSQLite$SQLiteConnection: BetterSqlite3$SQLiteConnection,
  };
});
