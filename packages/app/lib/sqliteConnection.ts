import { AnySqliteDatabase } from '@tloncorp/shared/db';
import { Schema } from '@tloncorp/shared/db/types';
import type { DrizzleConfig } from 'drizzle-orm/utils';

/**
 * Abstracts a connection to an SQLite database; see
 * `OPSQLite$SQLiteConnection` and `BetterSqlite3$SQLiteConnection` for
 * implementations.
 */
export interface SQLiteConnection<
  Client extends AnySqliteDatabase = AnySqliteDatabase,
> {
  execute(query: string): Promise<void>;
  updateHook(
    callback:
      | ((params: {
          table: string;
          operation: 'INSERT' | 'DELETE' | 'UPDATE';
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          row?: any;
          rowId: number;
        }) => void)
      | null
  ): void;
  getDbPath(): string;
  close(): void;
  delete(): void;
  migrateClient(client: Client): Promise<void>;
  // `Schema` is hardcoded here to match `AnySqliteDatabase`, which also
  // hardcodes `Schema`
  createClient(opts: DrizzleConfig<Schema>): Client;
}
