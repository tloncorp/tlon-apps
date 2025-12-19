import { schema, setClient } from '@tloncorp/shared/db';
import { handleChange } from '@tloncorp/shared/db';
import * as kv from '@tloncorp/shared/db';
import { migrations } from '@tloncorp/shared/db/migrations';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

import {
  BaseDb,
  changeLogTable,
  logger,
  useMigrations as useMigrationsBase,
} from './baseDb';

declare global {
  interface Window {
    sqliteBridge?: {
      init: () => Promise<boolean>;
      execute: (
        sql: string,
        params: any[],
        method: 'all' | 'run' | 'values' | 'get'
      ) => Promise<any>;
      runMigrations: (migrations: any[]) => Promise<boolean>;
      purgeDb: () => Promise<boolean>;
      getDbPath: () => Promise<string>;
      onDbChange: (callback: (data: any) => void) => () => void;
    };
  }
}

// Proxy driver that forwards SQL to the main process via callback function
// that matches AsyncRemoteCallback signature required by drizzle-orm
const createElectronSqliteDriver = () => {
  return async (
    sql: string,
    params: any[],
    method: 'all' | 'run' | 'values' | 'get'
  ) => {
    if (!window.sqliteBridge) {
      throw new Error('SQLite bridge not available - not running in Electron?');
    }

    try {
      logger.log('Executing SQL query:', { sql, params, method });

      const result = await window.sqliteBridge.execute(sql, params, method);

      // Format output according to method type
      if (method === 'get') {
        const row = result || null;
        logger.log('Get query result:', row);
        return { rows: row ? row : [] };
      } else {
        const rows = Array.isArray(result) ? result : [];
        logger.log('Query result rows:', rows.length);
        logger.log('First row:', rows[0]);
        return { rows };
      }
    } catch (error) {
      logger.error(
        'Error executing SQL query:',
        error,
        'SQL:',
        sql,
        'Params:',
        params,
        'Method:',
        method
      );
      throw error;
    }
  };
};

export class ElectronDb extends BaseDb {
  private changeUnsubscribe: (() => void) | null = null;

  async setupDb() {
    if (this.client) {
      logger.warn('setupDb called multiple times, ignoring');
      return;
    }

    if (!window.sqliteBridge) {
      throw new Error('SQLite bridge not available - not running in Electron?');
    }

    try {
      await window.sqliteBridge.init();

      const driver = createElectronSqliteDriver();
      this.client = drizzle(driver, {
        schema,
      });
      setClient(this.client);

      // Set up change listener
      this.changeUnsubscribe = window.sqliteBridge.onDbChange((changeData) => {
        try {
          handleChange({
            table: changeData.table,
            operation: changeData.operation,
            row: changeData.data,
          });
        } catch (e) {
          logger.error('Failed to process change:', e);
        }
      });

      logger.log('Electron SQLite database initialized');
    } catch (e) {
      logger.error('Failed to setup Electron SQLite db', e);
      throw e;
    }
  }

  async purgeDb() {
    if (!window.sqliteBridge) {
      throw new Error('SQLite bridge not available');
    }

    // Remove change listener
    if (this.changeUnsubscribe) {
      this.changeUnsubscribe();
      this.changeUnsubscribe = null;
    }

    logger.log('Purging Electron SQLite database');
    await window.sqliteBridge.purgeDb();
    this.client = null;

    // reset values related to tracking db sync state
    await kv.headsSyncedAt.resetValue();
    await kv.changesSyncedAt.resetValue();

    logger.log('Purged Electron SQLite database, reconnecting');
    await this.setupDb();
  }

  async getDbPath(): Promise<string | undefined> {
    if (!window.sqliteBridge) return undefined;
    return window.sqliteBridge.getDbPath();
  }

  async runMigrations() {
    if (!window.sqliteBridge) {
      throw new Error('SQLite bridge not available');
    }

    if (!this.client) {
      logger.warn('runMigrations called before setupDb, ignoring');
      return;
    }

    const formattedMigrations = [];

    if (migrations.journal && migrations.journal.entries) {
      for (const entry of migrations.journal.entries) {
        const migrationHash = `m${entry.tag.split('_')[0]}`;
        const sqlStatements = migrations.migrations[migrationHash];

        if (sqlStatements) {
          formattedMigrations.push({
            sql: [sqlStatements], // Wrap in array if it's a single string
          });
        }
      }
    }

    try {
      logger.log('Running migrations in Electron SQLite');
      await window.sqliteBridge.runMigrations(formattedMigrations);
      logger.log('Migrations completed successfully');
      return;
    } catch (e) {
      // Check if this is a "table already exists" error, which isn't fatal
      if (e.message && e.message.includes('already exists')) {
        logger.log(
          'Migration contains tables that already exist, continuing',
          e
        );
        return;
      }

      // For other errors, log but don't purge database
      logger.error('Migration failed:', e);

      // Only purge the database for critical errors that prevent app from working
      if (
        e.message &&
        (e.message.includes('database is corrupted') ||
          e.message.includes('database disk image is malformed'))
      ) {
        logger.error('Database appears corrupted, purging and retrying');
        await this.purgeDb();
        await window.sqliteBridge.runMigrations(formattedMigrations);
        logger.log('Migrations succeeded after purge');
      }
    }
  }

  // Override processChanges as changes are handled by the IPC mechanism
  protected async processChanges() {
    // Changes are handled by the change listener
    // This is kept for API compatibility
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
}

// Create singleton instance
const electronDb = new ElectronDb();
export const setupDb = () => electronDb.setupDb();
export const purgeDb = () => electronDb.purgeDb();
export const getDbPath = () => electronDb.getDbPath();
export const resetDb = () => electronDb.resetDb();
export const useMigrations = () => useMigrationsBase(electronDb);
export const checkDb = async () => {
  // Simulate checkDb interface from webDb
  const dbPath = await getDbPath();
  return {
    databasePath: dbPath,
    databaseSizeBytes: dbPath ? 1024 : 0, // Just return a dummy size
  };
};
