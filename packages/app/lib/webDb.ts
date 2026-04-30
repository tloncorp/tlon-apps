import type { Schema } from '@tloncorp/shared/db';
import { schema, setClient } from '@tloncorp/shared/db';
import {
  changesSyncedAt,
  headsSyncedAt,
  sqliteContent,
} from '@tloncorp/shared/db';
import { migrations } from '@tloncorp/shared/db/migrations';
import { readArrayBufferFromBlob } from '@tloncorp/shared/utils';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { debounce } from 'lodash';
import { SQLocalDrizzle } from 'sqlocal/drizzle';

import { BaseDb, logger, useMigrations as useMigrationsBase } from './baseDb';
import { TRIGGER_SETUP } from './triggers';
import migrate from './webMigrator';

const IS_SECURE_CONTEXT =
  typeof globalThis !== 'undefined' && globalThis.isSecureContext !== false;
const ENABLE_DB_FILE_LOAD = IS_SECURE_CONTEXT;
const ENABLE_DB_FILE_SAVE = IS_SECURE_CONTEXT;
const MIN_FREE_BYTES_BEFORE_VACUUM = 4 * 1024 * 1024;
const MIN_FREE_RATIO_BEFORE_VACUUM = 0.25;

// crypto.randomUUID() is only available in secure contexts. Polyfill it
// for plain HTTP so that SQLocal (which uses it internally) can function.
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = () =>
    '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: string) =>
      (
        +c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
      ).toString(16)
    ) as `${string}-${string}-${string}-${string}-${string}`;
}

export class WebDb extends BaseDb {
  private sqlocal: SQLocalDrizzle | null = null;

  async setupDb() {
    if (this.sqlocal || this.client) {
      logger.warn('setupDb called multiple times, ignoring');
      return;
    }
    try {
      // Await the onConnect callback to ensure the WASM driver is fully
      // initialized before sending any queries. In non-worker mode (used for
      // :memory: databases), SQLocal's processor.postMessage is async and
      // queries can race ahead of initialization without this.
      const sqlocal = await new Promise<SQLocalDrizzle>((resolve, reject) => {
        const instance = new SQLocalDrizzle({
          databasePath: ':memory:',
          verbose: false,
          onConnect: () => {
            clearTimeout(timeout);
            resolve(instance);
          },
        });
        const timeout = setTimeout(() => {
          instance.destroy();
          reject(new Error('SQLocal init timed out'));
        }, 15000);
      });
      this.sqlocal = sqlocal;

      const { driver } = sqlocal;
      this.client = drizzle(driver, { schema });

      // Immediately try to load DB from persisted file.
      // If successful, this will `overwriteDatabaseFile` which will reset the
      // connection to the DB - so make sure we don't do anything until this
      // promise resolves.
      let loadedFromFile = false;
      if (ENABLE_DB_FILE_LOAD) {
        try {
          loadedFromFile = await this.loadDbFromFile();
          if (loadedFromFile) {
            // run a query to get a SQLITE_CORRUPT if loaded DB is corrupt
            await this.sqlocal.sql`select null`;

            const { applied } = await migrate(
              this.client,
              migrations,
              this.sqlocal,
              { dryRun: true }
            );
            if (applied.length > 0) {
              // We need to apply migrations - since we don't do delta
              // migrations, we need to purge the DB and start fresh.
              // We can do this by throwing to the catch below.
              throw new Error('Loaded DB is outdated, needs migrations');
            }
          }
        } catch (e) {
          console.warn(
            'Failed to load DB from file, continuing with empty DB',
            e
          );
          await this.sqlocal.deleteDatabaseFile();
          loadedFromFile = false;
        }
      }

      // No persisted DB carried sync state forward, so anything we previously
      // tracked in localStorage about "what has been synced" is meaningless.
      // Reset the sync watermarks so the initial sync refetches heads.
      if (!loadedFromFile) {
        await headsSyncedAt.resetValue();
        await changesSyncedAt.resetValue();
      }

      logger.log('sqlocal instance created', { sqlocal: this.sqlocal });

      // Expose devtools helpers for diagnosing migration/schema state.
      try {
        const sqlocal = this.sqlocal;
        const g: any = globalThis;
        // __tlonRawSql runs arbitrary SQL against the user's local DB —
        // gate behind __DEV__ so it only exists in dev builds.
        if (__DEV__) {
          g.__tlonRawSql = async (query: string) => {
            const rows = await sqlocal.sql(query);
            // eslint-disable-next-line no-console
            console.table(rows);
            return rows;
          };
        }
        g.__tlonDbState = async () => {
          const migrations = await sqlocal.sql(
            `SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC`
          );
          const postsIndexes = await sqlocal.sql(
            `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='posts' ORDER BY name`
          );
          const [postsCount] = await sqlocal.sql(
            `SELECT COUNT(*) as n FROM posts`
          );
          // eslint-disable-next-line no-console
          console.log('Applied migrations:');
          // eslint-disable-next-line no-console
          console.table(migrations);
          // eslint-disable-next-line no-console
          console.log('Posts table indexes:');
          // eslint-disable-next-line no-console
          console.table(postsIndexes);
          // eslint-disable-next-line no-console
          console.log('Posts row count:', postsCount);
          return { migrations, postsIndexes, postsCount };
        };
      } catch (e) {
        logger.warn('Failed to register devtools DB helpers', e);
      }

      // Experimental SQLite settings. May cause crashes. More here:
      // https://ospfranco.notion.site/Configuration-6b8b9564afcc4ac6b6b377fe34475090
      await this.sqlocal.sql('PRAGMA mmap_size=268435456');
      // await this.sqlocal.sql('PRAGMA journal_mode=MEMORY');
      await this.sqlocal.sql('PRAGMA synchronous=OFF');
      await this.sqlocal.sql('PRAGMA journal_mode=WAL');

      await this.sqlocal.createCallbackFunction('processChanges', () => {
        this.enqueueProcessChanges();
      });

      setClient(this.client);

      const dbInfo = await this.sqlocal.getDatabaseInfo();
      logger.log('SQLite database opened:', dbInfo);
    } catch (e) {
      logger.error('Failed to setup SQLite db', e);
    }
  }

  /** Returns true if a persisted DB was loaded, false if none was found. */
  private async loadDbFromFile(): Promise<boolean> {
    if (this.sqlocal == null) {
      return false;
    }

    const loaded = await sqliteContent.getValue();
    if (loaded == null) {
      return false;
    }
    await this.sqlocal.overwriteDatabaseFile(loaded);
    return true;
  }

  private saveToFile = debounce(
    async () => {
      if (this.sqlocal == null) {
        return;
      }
      await this.maybeCompactBeforeSave();

      const sqlocal = this.sqlocal;
      if (sqlocal == null) {
        return;
      }

      try {
        const dbFile = await sqlocal.getDatabaseFile();
        if (dbFile == null) {
          return;
        }

        const encoded = await readArrayBufferFromBlob(dbFile);
        await sqliteContent.setValue(encoded);
      } catch (e) {
        console.error('Failed to save to file', e);
      }
    },
    1000,
    { trailing: true }
  );

  private async maybeCompactBeforeSave() {
    if (this.sqlocal == null) return;

    try {
      const [stats] = await this.sqlocal.sql<{
        page_count: number;
        freelist_count: number;
        page_size: number;
      }>(`
        SELECT page_count AS page_count, freelist_count AS freelist_count, page_size AS page_size
        FROM pragma_page_count(), pragma_freelist_count(), pragma_page_size()
      `);
      if (!stats || stats.page_count <= 0) return;

      const { page_count, freelist_count, page_size } = stats;
      const freeBytes = freelist_count * page_size;
      const freeRatio = freelist_count / page_count;

      if (
        freeBytes < MIN_FREE_BYTES_BEFORE_VACUUM &&
        freeRatio < MIN_FREE_RATIO_BEFORE_VACUUM
      ) {
        return;
      }

      logger.log('Vacuuming SQLite database before export', {
        page_count,
        freelist_count,
        page_size,
        freeBytes,
        freeRatio,
      });
      await this.sqlocal.sql('VACUUM');
    } catch (e) {
      console.warn('Failed to compact SQLite database before export', e);
    }
  }

  // Coalesce processChanges callbacks. SQLocal's `SELECT processChanges()`
  // trigger fires once per __change_log row, and each callback round-trips
  // main↔worker via postMessage (no SharedArrayBuffer fallback). A bulk
  // insert of N rows would otherwise queue N separate callbacks, each
  // paying a ~20 ms round-trip even after the first one drains the log.
  // Bundling to a single trailing invocation per event-loop tick turns N
  // callbacks into one.
  //
  // Fire-and-forget on purpose: callers proceed immediately and the actual
  // processChanges drain happens on the next tick. Don't override the base
  // async processChanges — that signature would lie about completion.
  private pendingProcessChanges: ReturnType<typeof setTimeout> | null = null;

  private enqueueProcessChanges() {
    if (this.pendingProcessChanges != null) return;
    this.pendingProcessChanges = setTimeout(async () => {
      this.pendingProcessChanges = null;
      await this.processChanges();
      if (ENABLE_DB_FILE_SAVE) {
        this.saveToFile();
      }
    }, 0);
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
      await sqliteContent.resetValue();
      return;
    }
    logger.log('purging sqlite database');
    this.saveToFile.cancel();
    await sqliteContent.resetValue();
    await headsSyncedAt.resetValue();
    await changesSyncedAt.resetValue();
    await this.sqlocal.destroy();
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
