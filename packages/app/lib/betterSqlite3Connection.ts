import type { Schema } from '@tloncorp/shared/dist/db';
import type { AnySqliteDatabase } from '@tloncorp/shared/dist/db/client';
import { migrations } from '@tloncorp/shared/dist/db/migrations';
import type { Database } from 'better-sqlite3';
import type { DrizzleConfig } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import type { SQLiteConnection } from './sqliteConnection';

export class BetterSqlite3$SQLiteConnection implements SQLiteConnection {
  constructor(private connection: Database) {}

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
    console.warn(
      'BetterSqlite3$SQLiteConnection::updateHook() is not implemented'
    );
    // TODO
    // https://github.com/WiseLibs/better-sqlite3/issues/62#issuecomment-325797335
    return;
  }

  getDbPath(): string {
    return this.connection.name;
  }

  close(): void {
    this.connection.close();
  }

  delete(): void {
    console.warn('BetterSqlite3$SQLiteConnection::delete() is not implemented');
    return;
  }

  async migrateClient(_client: AnySqliteDatabase): Promise<void> {
    Object.entries(migrations.migrations)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .forEach(([_key, migration]) => {
        // @ts-expect-error - migration is an SQL import
        this.execute(migration);
      });
    return;
  }

  createClient(opts: DrizzleConfig<Schema>): AnySqliteDatabase {
    // `AnySqliteDatabase` does not accept `TMode = 'sync'`
    // https://github.com/tloncorp/tlon-apps/blob/ab95618a6813fcafc3db3c45a7a54f69c4c9522b/packages/shared/src/db/client.ts#L7-L8
    return drizzle(this.connection, opts) as unknown as AnySqliteDatabase;
  }
}
