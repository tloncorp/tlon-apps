import type { Schema } from '@tloncorp/shared/db';
import { schema, setClient } from '@tloncorp/shared/db';
import { sqliteContent } from '@tloncorp/shared/db';
import { migrations } from '@tloncorp/shared/db/migrations';
import { readArrayBufferFromBlob } from '@tloncorp/shared/utils';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { debounce } from 'lodash';
import { SQLocalDrizzle } from 'sqlocal/drizzle';

import { BaseDb, logger, useMigrations as useMigrationsBase } from './baseDb';
import { TRIGGER_SETUP } from './triggers';
import migrate from './webMigrator';

const ENABLE_DB_FILE_LOAD = true;
const ENABLE_DB_FILE_SAVE = true;

export class WebDb extends BaseDb {
  private sqlocal: SQLocalDrizzle | null = null;

  async setupDb() {
    if (this.sqlocal || this.client) {
      logger.warn('setupDb called multiple times, ignoring');
      return;
    }
    try {
      this.sqlocal = new SQLocalDrizzle({
        databasePath: ':memory:',
        verbose: false,
      });

      // Immediately try to load DB from persisted file.
      // If successful, this will `overwriteDatabaseFile` which will reset the
      // connection to the DB - so make sure we don't do anything until this
      // promise resolves.
      if (ENABLE_DB_FILE_LOAD) {
        try {
          await this.loadDbFromFile();
          // run a query to get a SQLITE_CORRUPT if loaded DB is corrupt
          await this.sqlocal.sql`select null`;
        } catch (e) {
          console.warn(
            'Failed to load DB from file, continuing with empty DB',
            e
          );
          await this.sqlocal.deleteDatabaseFile();
        }
      }

      logger.log('sqlocal instance created', { sqlocal: this.sqlocal });
      // Experimental SQLite settings. May cause crashes. More here:
      // https://ospfranco.notion.site/Configuration-6b8b9564afcc4ac6b6b377fe34475090
      await this.sqlocal.sql('PRAGMA mmap_size=268435456');
      // await this.sqlocal.sql('PRAGMA journal_mode=MEMORY');
      await this.sqlocal.sql('PRAGMA synchronous=OFF');
      await this.sqlocal.sql('PRAGMA journal_mode=WAL');

      await this.sqlocal.createCallbackFunction('processChanges', async () =>
        this.processChanges()
      );

      const { driver } = this.sqlocal;

      this.client = drizzle(driver, { schema });
      setClient(this.client);

      const dbInfo = await this.sqlocal.getDatabaseInfo();
      logger.log('SQLite database opened:', dbInfo);
    } catch (e) {
      logger.error('Failed to setup SQLite db', e);
    }
  }

  /** If no DB exists in storage, does nothing (i.e. should not error). */
  private async loadDbFromFile() {
    if (this.sqlocal == null) {
      return;
    }

    const loaded = await sqliteContent.getValue();
    if (loaded != null) {
      await this.sqlocal.overwriteDatabaseFile(loaded);
    }
  }

  private saveToFile = debounce(
    async () => {
      if (this.sqlocal == null) {
        return;
      }
      const { getDatabaseFile } = this.sqlocal;

      const dbFile = await getDatabaseFile();
      if (dbFile != null) {
        try {
          const encoded = await readArrayBufferFromBlob(dbFile);
          await sqliteContent.setValue(encoded);
        } catch (e) {
          console.error('Failed to save to file', e);
        }
      }
    },
    1000,
    { trailing: true }
  );

  override async processChanges() {
    await super.processChanges();

    if (ENABLE_DB_FILE_SAVE) {
      this.saveToFile();
    }
  }

  async checkDb() {
    if (!this.sqlocal) {
      logger.warn('checkDb called before setupDb, ignoring');
      return;
    }
    const dbInfo = await this.sqlocal.getDatabaseInfo();
    logger.log('SQLite database info:', dbInfo);
    return dbInfo;
  }

  async purgeDb() {
    if (!this.sqlocal) {
      logger.warn('purgeDb called before setupDb, ignoring');
      return;
    }
    logger.log('purging sqlite database');
    this.sqlocal.destroy();
    this.sqlocal = null;
    this.client = null;
    logger.log('purged sqlite database, recreating');
    await this.setupDb();
  }

  async getDbPath() {
    return this.sqlocal?.getDatabaseInfo().then((info) => info.databasePath);
  }

  async runMigrations() {
    if (!this.client || !this.sqlocal) {
      logger.warn('runMigrations called before setupDb, ignoring');
      return;
    }

    try {
      logger.log('runMigrations: starting migration');
      await migrate<Schema>(this.client, migrations, this.sqlocal);
      logger.log('runMigrations: migrations succeeded');
      await this.sqlocal.sql(TRIGGER_SETUP);

      await this.sqlocal.sql(`
        CREATE TRIGGER IF NOT EXISTS after_changes_insert
        AFTER INSERT ON __change_log
        BEGIN
          SELECT processChanges();
        END;
      `);

      return;
    } catch (e) {
      logger.log('migrations failed, purging db and retrying', e);
    }
    await this.purgeDb();
    await migrate(this.client, migrations, this.sqlocal);
    logger.log("migrations succeeded after purge, shouldn't happen often");
  }
}

// Create singleton instance
const webDb = new WebDb();
export const setupDb = () => webDb.setupDb();
export const checkDb = () => webDb.checkDb();
export const purgeDb = () => webDb.purgeDb();
export const getDbPath = () => webDb.getDbPath();
export const resetDb = () => webDb.resetDb();
export const useMigrations = () => useMigrationsBase(webDb);
