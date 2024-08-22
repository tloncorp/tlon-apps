import { OPSQLiteConnection } from '@op-engineering/op-sqlite';
import { migrations } from '@tloncorp/shared/dist/db/migrations';
import { Schema } from '@tloncorp/shared/dist/db/types';
import { DrizzleConfig } from 'drizzle-orm';
import type { OPSQLiteDatabase } from 'drizzle-orm/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { migrate } from 'drizzle-orm/op-sqlite/migrator';

import { SQLiteConnection } from './sqliteConnection';

export class OPSQLite$SQLiteConnection
  implements SQLiteConnection<OPSQLiteDatabase<Schema>>
{
  constructor(private connection: OPSQLiteConnection) {}

  execute(query: string): void {
    this.connection.execute(query);
  }

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
  ): void {
    this.connection.updateHook(callback);
  }

  getDbPath(): string {
    return this.connection.getDbPath();
  }

  close(): void {
    this.connection.close();
  }

  delete(): void {
    this.connection.delete();
  }

  async migrateClient(client: OPSQLiteDatabase<Schema>): Promise<void> {
    await migrate(client, migrations);
  }

  createClient(opts: DrizzleConfig<Schema>): OPSQLiteDatabase<Schema> {
    return drizzle(this.connection, opts);
  }
}
