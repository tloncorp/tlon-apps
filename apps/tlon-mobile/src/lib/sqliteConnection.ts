import { AnySqliteDatabase } from '@tloncorp/shared/dist/db/client';
import { Schema } from '@tloncorp/shared/dist/db/types';
import type { DrizzleConfig } from 'drizzle-orm/utils';

export interface SQLiteConnection<
  Client extends AnySqliteDatabase = AnySqliteDatabase,
> {
  execute(query: string): void;
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
  // hardcode `Schema` to match `AnySqliteDatabase`
  createClient(opts: DrizzleConfig<Schema>): Client;
}
