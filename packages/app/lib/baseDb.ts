import { createDevLogger } from '@tloncorp/shared';
import { handleChange } from '@tloncorp/shared/db';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { useEffect, useMemo, useState } from 'react';

export const enableLogger = false;
export const logger = createDevLogger('db', enableLogger);

export const changeLogTable = sqliteTable('__change_log', {
  id: integer('id').primaryKey(),
  table_name: text('table_name').notNull(),
  operation: text('operation').notNull(),
  row_id: integer('row_id'),
  row_data: text('row_data'),
  timestamp: integer('timestamp').default(sql`(strftime('%s', 'now'))`),
});

export function useMigrations(db: BaseDb) {
  const [hasSucceeded, setHasSucceeded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    logger.log('running migrations');
    const startTime = Date.now();
    db.runMigrations()
      .then(() => setHasSucceeded(true))
      .catch((e) => {
        logger.log('failed to migrate database', e);
        setError(e);
      })
      .finally(() =>
        logger.log('migrations complete in', Date.now() - startTime + 'ms')
      );
  }, [db]);

  return useMemo(
    () => ({
      success: hasSucceeded,
      error: error,
    }),
    [hasSucceeded, error]
  );
}

export abstract class BaseDb {
  protected client: any = null;
  protected isPolling = false;

  abstract setupDb(): Promise<void>;
  abstract purgeDb(): Promise<void>;
  abstract getDbPath(): Promise<string | undefined>;
  abstract runMigrations(): Promise<void>;

  protected async processChanges() {
    if (!this.client) return;

    try {
      const changes = await this.client.select().from(changeLogTable).all();
      for (const change of changes) {
        handleChange({
          table: change.table_name,
          operation: change.operation as 'INSERT' | 'UPDATE' | 'DELETE',
          row: JSON.parse(change.row_data ?? ''),
        });
      }
      await this.client.delete(changeLogTable).run();
    } catch (e) {
      logger.error('failed to process changes:', e);
    }
  }

  async resetDb() {
    await this.purgeDb();
    await this.runMigrations();
  }
}
