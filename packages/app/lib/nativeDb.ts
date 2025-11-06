import { open } from '@op-engineering/op-sqlite';
import { AnalyticsEvent, AnalyticsSeverity, escapeLog } from '@tloncorp/shared';
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
  private didMigrate: boolean = false;

  async setupDb() {
    logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
      context: 'setupDb: starting setup',
    });
    if (this.connection || this.client) {
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'setupDb: already have existing connection, ignoring',
      });
      return;
    }
    try {
      this.connection = new OPSQLite$SQLiteConnection(
        // NB: the iOS code in SQLiteDB.swift relies on this path - if you change
        // this, you should change that too.
        open({ location: 'default', name: 'tlon.sqlite' })
      );
      // Experimental SQLite settings. May cause crashes. More here:
      // https://ospfranco.notion.site/Configuration-6b8b9564afcc4ac6b6b377fe34475090
      await this.connection.execute('PRAGMA mmap_size=268435456');
      await this.connection.execute('PRAGMA journal_mode=DELETE');
      await this.connection.execute('PRAGMA synchronous=OFF');

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
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        context: 'setupDb: error setting up db',
        errorMessage: e.message,
        errorStack: e.stack,
        severity: AnalyticsSeverity.Critical,
      });
      throw e;
    }
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
    logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
      context: 'purgeDb: purging db',
    });
    if (!this.connection) {
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context:
          'purgeDb: attempted before connection connection was set up, skipping',
      });
      return;
    }
    try {
      this.connection.close();
      this.connection.delete();
      this.connection = null;
      this.client = null;
      this.didMigrate = false;

      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'purgeDb: closed the connection, cleared the client',
      });

      // reset values related to tracking db sync state
      await kv.headsSyncedAt.resetValue();

      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'purgeDb: completed purge, recreating',
      });
      await this.setupDb();
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'purgeDb: post-purge setup complete',
      });
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        context: 'purgeDb: error purging db',
        errorMessage: e.message,
        errorStack: e.stack,
        severity: AnalyticsSeverity.Critical,
      });
      throw e;
    }
  }

  async getDbPath(): Promise<string | undefined> {
    return this.connection?.getDbPath();
  }

  async runMigrations() {
    if (this.didMigrate) {
      return;
    }

    logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
      context: 'runMigrations: starting migrations',
    });
    if (!this.client || !this.connection) {
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context:
          'runMigrations: attempted before connection connection was set up, skipping',
      });
      return;
    }

    const MIGRATION_TIMEOUT = 3000; // 3 seconds

    try {
      await Promise.race([
        this.connection?.migrateClient(this.client!),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Migration timeout exceeded')),
            MIGRATION_TIMEOUT
          )
        ),
      ]);
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'runMigrations: successfully migrated DB',
      });
      await this.connection?.execute(TRIGGER_SETUP);
      this.didMigrate = true;
      return;
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        context:
          'runMigrations: migrations failed. Attempting to purge and retry',
        errorMessage: e.message,
        errorStack: e.stack,
        severity: AnalyticsSeverity.Critical,
      });
    }
    try {
      await this.purgeDb();
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'runMigrations: migration retry: purged db',
      });
      await Promise.race([
        this.connection?.migrateClient(this.client!),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Migration timeout exceeded on retry')),
            MIGRATION_TIMEOUT
          )
        ),
      ]);
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context:
          'runMigrations: migration retry: successfully migrated on retry (this should not happen often)',
      });
      this.didMigrate = true;
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        context: 'runMigrations: migration retry failed. Giving up',
        errorMessage: e.message,
        errorStack: e.stack,
        severity: AnalyticsSeverity.Critical,
      });
      throw e;
    }
  }
}

// Create singleton instance
const nativeDb = new NativeDb();
export const setupDb = () => nativeDb.setupDb();
export const purgeDb = () => nativeDb.purgeDb();
export const getDbPath = () => nativeDb.getDbPath();
export const resetDb = () => nativeDb.resetDb();
export const runMigrations = () => nativeDb.runMigrations();
export const useMigrations = () => useMigrationsBase(nativeDb);
