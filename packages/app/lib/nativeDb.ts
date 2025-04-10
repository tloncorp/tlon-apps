import { open } from '@op-engineering/op-sqlite';
import { escapeLog } from '@tloncorp/shared';
import * as kv from '@tloncorp/shared/db';
import { schema, setClient } from '@tloncorp/shared/db';

import {
  BaseDb,
  enableLogger,
  logger,
  useMigrations as useMigrationsBase,
} from './baseDb';
import { OPSQLite$SQLiteConnection } from './opsqliteConnection';
import { SQLiteConnection } from './sqliteConnection';
import { TRIGGER_SETUP } from './triggers';

export class NativeDb extends BaseDb {
  private connection: SQLiteConnection | null = null;
  private isProcessingChanges: boolean = false;
  private changesPending: boolean = false;

  async setupDb() {
    if (this.connection || this.client) {
      logger.warn('setupDb called multiple times, ignoring');
      return;
    }
    this.connection = new OPSQLite$SQLiteConnection(
      // NB: the iOS code in SQLiteDB.swift relies on this path - if you change
      // this, you should change that too.
      open({ location: 'default', name: 'tlon.sqlite' })
    );
    // Experimental SQLite settings. May cause crashes. More here:
    // https://ospfranco.notion.site/Configuration-6b8b9564afcc4ac6b6b377fe34475090
    this.connection.execute('PRAGMA mmap_size=268435456');
    this.connection.execute('PRAGMA journal_mode=MEMORY');
    this.connection.execute('PRAGMA synchronous=OFF');

    this.connection.updateHook(() => this.handleUpdate());

    this.client = this.connection.createClient({
      schema,
      logger: enableLogger
        ? {
            logQuery(query, params) {
              logger.log(escapeLog(query), params);
            },
          }
        : undefined,
    });
    setClient(this.client);
    logger.log('SQLite database opened at', this.connection.getDbPath());
  }

  async handleUpdate() {
    if (this.isProcessingChanges) {
      this.changesPending = true;
      return;
    }
    this.isProcessingChanges = true;
    await this.processChanges();
    this.isProcessingChanges = false;
    if (this.changesPending) {
      this.changesPending = false;
      this.handleUpdate();
    }
  }

  async purgeDb() {
    if (!this.connection) {
      logger.warn('purgeDb called before setupDb, ignoring');
      return;
    }
    logger.log('purging sqlite database');
    this.connection.close();
    this.connection.delete();
    this.connection = null;
    this.client = null;

    // reset values related to tracking db sync state
    await kv.headsSyncedAt.resetValue();

    logger.log('purged sqlite database, recreating');
    await this.setupDb();
  }

  async getDbPath(): Promise<string | undefined> {
    return this.connection?.getDbPath();
  }

  async runMigrations() {
    if (!this.client || !this.connection) {
      logger.warn('runMigrations called before setupDb, ignoring');
      return;
    }

    try {
      await this.connection?.migrateClient(this.client!);
      this.connection?.execute(TRIGGER_SETUP);
      return;
    } catch (e) {
      logger.log('migrations failed, purging db and retrying', e);
    }
    await this.purgeDb();
    await this.connection?.migrateClient(this.client!);
    logger.log("migrations succeeded after purge, shouldn't happen often");
  }
}

// Create singleton instance
const nativeDb = new NativeDb();
export const setupDb = () => nativeDb.setupDb();
export const purgeDb = () => nativeDb.purgeDb();
export const getDbPath = () => nativeDb.getDbPath();
export const resetDb = () => nativeDb.resetDb();
export const useMigrations = () => useMigrationsBase(nativeDb);
