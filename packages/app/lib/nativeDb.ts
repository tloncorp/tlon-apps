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

  async setupDb() {
    logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
      message: 'setupDb: starting setup',
    });
    if (this.connection || this.client) {
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        message: 'setupDb: already have existing connection, ignoring',
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
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        message: 'setupDb: error setting up db',
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
      message: 'purgeDb: purging db',
    });
    if (!this.connection) {
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        message:
          'purgeDb: attempted before connection connection was set up, skipping',
      });
      return;
    }
    try {
      this.connection.close();
      this.connection.delete();
      this.connection = null;
      this.client = null;

      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        message: 'purgeDb: closed the connection, cleared the client',
      });

      // reset values related to tracking db sync state
      await kv.headsSyncedAt.resetValue();

      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        message: 'purgeDb: completed purge, recreating',
      });
      await this.setupDb();
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        message: 'purbeDb: post-purge setup complete',
      });
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        message: 'purgeDb: error purging db',
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
    logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
      message: 'runMigrations: starting migrations',
    });
    if (!this.client || !this.connection) {
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        message:
          'runMigrations: attempted before connection connection was set up, skipping',
      });
      return;
    }

    try {
      await this.connection?.migrateClient(this.client!);
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        message: 'runMigrations: successfully migrated DB',
      });
      this.connection?.execute(TRIGGER_SETUP);
      return;
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        message:
          'runMigrations: migrations failed. Attempting to purge and retry',
        errorMessage: e.message,
        errorStack: e.stack,
        severity: AnalyticsSeverity.Critical,
      });
    }
    try {
      await this.purgeDb();
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        message: 'runMigrations: migration retry: purged db',
      });
      await this.connection?.migrateClient(this.client!);
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        message:
          'runMigrations: migration retry: successfully migrated on retry (this should not happen often)',
      });
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        message: 'runMigrations: migration retry failed. Giving up',
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
export const useMigrations = () => useMigrationsBase(nativeDb);
