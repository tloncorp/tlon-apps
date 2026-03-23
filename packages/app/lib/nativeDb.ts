import { open } from '@op-engineering/op-sqlite';
import { AnalyticsEvent, AnalyticsSeverity, escapeLog } from '@tloncorp/shared';
import * as kv from '@tloncorp/shared/db';
import { schema, setClient } from '@tloncorp/shared/db';
import { getTableName } from 'drizzle-orm';

import {
  BaseDb,
  enableLogger,
  logger,
  useMigrations as useMigrationsBase,
} from './baseDb';
import { OPSQLite$SQLiteConnection } from './opsqliteConnection';
import { SQLiteConnection } from './sqliteConnection';
import { TRIGGER_SETUP } from './triggers';

export const REQUIRED_SENTINEL_TABLES = [
  schema.groups,
  schema.channels,
  schema.posts,
  schema.activityEvents,
].map((table) => getTableName(table));

export class NativeDb extends BaseDb {
  private connection: SQLiteConnection | null = null;
  private isProcessingChanges: boolean = false;
  private changesPending: boolean = false;
  private didMigrate: boolean = false;
  private setupPromise: Promise<void> | null = null;
  private readyPromise: Promise<void> | null = null;

  async setupDb() {
    logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
      context: 'setupDb: starting setup',
    });
    if (this.connection && this.client) {
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'setupDb: already have existing connection, ignoring',
      });
      return;
    }

    if (this.setupPromise) {
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'setupDb: setup already in progress, awaiting existing setup',
      });
      await this.setupPromise;
      return;
    }

    this.setupPromise = (async () => {
      try {
        if (this.connection && !this.client) {
          logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
            context:
              'setupDb: found connection without client, resetting stale connection',
          });
          this.connection.close();
          this.connection = null;
        }

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
    })();

    try {
      await this.setupPromise;
    } finally {
      this.setupPromise = null;
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
      await kv.changesSyncedAt.resetValue();

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

  async ensureDbReady() {
    if (this.didMigrate && this.connection && this.client) {
      return;
    }

    if (this.readyPromise) {
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'ensureDbReady: awaiting in-flight db initialization',
      });
      await this.readyPromise;
      return;
    }

    this.readyPromise = (async () => {
      await this.setupDb();
      if (!this.didMigrate) {
        await this.runMigrationsInternal();
      }
    })();

    try {
      await this.readyPromise;
    } finally {
      this.readyPromise = null;
    }
  }

  async runMigrations() {
    await this.ensureDbReady();
    if (!this.didMigrate) {
      throw new Error(
        'runMigrations: completed without recording successful migration'
      );
    }
  }

  private async verifyRequiredTables(opts?: {
    attemptId?: string;
    elapsedMs?: () => number;
    migrationPhase?: 'initial' | 'retry';
  }) {
    if (!this.connection) {
      throw new Error(
        'runMigrations: schema check attempted without connection'
      );
    }

    const missingTables: string[] = [];

    for (const tableName of REQUIRED_SENTINEL_TABLES) {
      try {
        await this.connection.execute(`SELECT 1 FROM "${tableName}" LIMIT 1`);
      } catch {
        missingTables.push(tableName);
      }
    }

    if (missingTables.length > 0) {
      const error = new Error(
        `runMigrations: schema health check failed. Missing required tables: ${missingTables.join(
          ', '
        )}`
      );
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        context: 'runMigrations: schema health check failed',
        errorMessage: error.message,
        errorStack: error.stack,
        missingTables,
        attemptId: opts?.attemptId,
        elapsedMs: opts?.elapsedMs?.(),
        migrationPhase: opts?.migrationPhase,
        severity: AnalyticsSeverity.Critical,
      });
      throw error;
    }

    logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
      context: 'runMigrations: schema health check passed',
      attemptId: opts?.attemptId,
      elapsedMs: opts?.elapsedMs?.(),
      migrationPhase: opts?.migrationPhase,
    });
  }

  private async runMigrationsInternal() {
    if (this.didMigrate) {
      return;
    }

    const attemptId = `native-db-migrate-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const migrationStartTimeMs = Date.now();
    const getElapsedMs = () => Date.now() - migrationStartTimeMs;

    logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
      context: 'runMigrations: starting migrations',
      attemptId,
      elapsedMs: getElapsedMs(),
    });

    if (!this.client || !this.connection) {
      const error = new Error(
        'runMigrations: connection/client missing after setup'
      );
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        context: 'runMigrations: setup incomplete before migration',
        errorMessage: error.message,
        errorStack: error.stack,
        severity: AnalyticsSeverity.Critical,
      });
      throw error;
    }

    const MIGRATION_TIMEOUT = 5000; // 5 seconds
    const runMigrationAttempt = async (
      timeoutMessage: string,
      migrationPhase: 'initial' | 'retry'
    ) => {
      if (!this.client || !this.connection) {
        throw new Error(
          'runMigrations: connection/client missing before migration attempt'
        );
      }

      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'runMigrations: migrate attempt start',
        attemptId,
        elapsedMs: getElapsedMs(),
        migrationPhase,
      });

      await Promise.race([
        this.connection.migrateClient(this.client),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(timeoutMessage)), MIGRATION_TIMEOUT)
        ),
      ]);

      await this.verifyRequiredTables({
        attemptId,
        elapsedMs: getElapsedMs,
        migrationPhase,
      });
      await this.connection.execute(TRIGGER_SETUP);
      this.didMigrate = true;
    };

    try {
      await runMigrationAttempt('Migration timeout exceeded', 'initial');
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context:
          'runMigrations: successfully migrated DB and passed schema health check',
        attemptId,
        elapsedMs: getElapsedMs(),
        migrationPhase: 'initial',
      });
      return;
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        context:
          'runMigrations: migration/schema verification failed. Attempting to purge and retry',
        errorMessage: e.message,
        errorStack: e.stack,
        attemptId,
        elapsedMs: getElapsedMs(),
        migrationPhase: 'initial',
        severity: AnalyticsSeverity.Critical,
      });
    }
    logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
      context: 'runMigrations: retry start',
      attemptId,
      elapsedMs: getElapsedMs(),
    });

    try {
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'runMigrations: retry purge start',
        attemptId,
        elapsedMs: getElapsedMs(),
      });
      await this.purgeDb();
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'runMigrations: retry purge success',
        attemptId,
        elapsedMs: getElapsedMs(),
      });
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        context: 'runMigrations: retry purge failed',
        errorMessage: e.message,
        errorStack: e.stack,
        attemptId,
        elapsedMs: getElapsedMs(),
        severity: AnalyticsSeverity.Critical,
      });
      throw e;
    }

    if (!this.client || !this.connection) {
      throw new Error(
        'runMigrations: connection/client missing after purge retry setup'
      );
    }

    logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
      context: 'runMigrations: retry migrate start',
      attemptId,
      elapsedMs: getElapsedMs(),
      migrationPhase: 'retry',
    });

    try {
      await runMigrationAttempt('Migration timeout exceeded on retry', 'retry');
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context:
          'runMigrations: retry migrate success (schema health check passed)',
        attemptId,
        elapsedMs: getElapsedMs(),
        migrationPhase: 'retry',
      });
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        context: 'runMigrations: retry migrate failed',
        errorMessage: e.message,
        errorStack: e.stack,
        attemptId,
        elapsedMs: getElapsedMs(),
        migrationPhase: 'retry',
        severity: AnalyticsSeverity.Critical,
      });
      throw e;
    }
  }
}

// Create singleton instance
const nativeDb = new NativeDb();
export const setupDb = () => nativeDb.setupDb();
export const ensureDbReady = () => nativeDb.ensureDbReady();
export const purgeDb = () => nativeDb.purgeDb();
export const getDbPath = () => nativeDb.getDbPath();
export const resetDb = () => nativeDb.resetDb();
export const runMigrations = () => nativeDb.runMigrations();
export const useMigrations = () => useMigrationsBase(nativeDb);
