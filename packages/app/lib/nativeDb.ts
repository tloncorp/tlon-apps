import { open } from '@op-engineering/op-sqlite';
import { AnalyticsEvent, AnalyticsSeverity, escapeLog } from '@tloncorp/shared';
import { schema, setClient } from '@tloncorp/shared/db';
import { getTableName } from 'drizzle-orm';

import {
  BaseDb,
  enableLogger,
  logger,
  resetDbSyncState,
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

type NativeDbOptions = {
  databaseName?: string;
  resetSyncStateOnPurge?: boolean;
};

/**
 * Closing a connection we are already unwinding from is best-effort: the
 * failure that got us here is the one worth reporting.
 */
function closeQuietly(connection: SQLiteConnection | null) {
  if (!connection) {
    return;
  }
  try {
    connection.close();
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
      context: 'closeQuietly: failed to close discarded connection',
      errorMessage: e.message,
    });
  }
}

/**
 * Thrown by the remains of an initialization that `abandonDbInit` detached. It
 * is not a database failure -- a replacement initialization owns the state now
 * -- so it exists to stop the abandoned attempt rather than to be recovered
 * from.
 */
export class DbInitAbandonedError extends Error {
  constructor(context: string) {
    super(`${context}: database initialization was abandoned and replaced`);
    this.name = 'DbInitAbandonedError';
  }
}

export class NativeDb extends BaseDb {
  private connection: SQLiteConnection | null = null;
  private isProcessingChanges: boolean = false;
  private changesPending: boolean = false;
  private didMigrate: boolean = false;
  private setupPromise: Promise<void> | null = null;
  private readyPromise: Promise<void> | null = null;
  // Bumped by `abandonDbInit`. An attempt captures this when it starts and
  // stops writing shared state once it no longer matches, so an attempt that
  // was given up on can't clobber the one that replaced it if it settles late.
  private generation: number = 0;
  private readonly databaseName: string;
  private readonly resetSyncStateOnPurge: boolean;

  constructor({
    databaseName = 'tlon.sqlite',
    resetSyncStateOnPurge = true,
  }: NativeDbOptions = {}) {
    super();
    this.databaseName = databaseName;
    this.resetSyncStateOnPurge = resetSyncStateOnPurge;
  }

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

    const generation = this.generation;

    const setupPromise = (async () => {
      // Held locally until the pragmas are through, so a setup that gets
      // abandoned along the way closes what it opened instead of publishing it
      // over the connection that replaced it.
      let connection: SQLiteConnection | null = null;
      try {
        if (this.connection && !this.client) {
          logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
            context:
              'setupDb: found connection without client, resetting stale connection',
          });
          this.connection.close();
          this.connection = null;
        }

        connection = new OPSQLite$SQLiteConnection(
          // NB: the iOS code in SQLiteDB.swift relies on this path - if you change
          // this, you should change that too.
          open({ location: 'default', name: this.databaseName })
        );
        // Experimental SQLite settings. May cause crashes. More here:
        // https://ospfranco.notion.site/Configuration-6b8b9564afcc4ac6b6b377fe34475090
        await connection.execute('PRAGMA mmap_size=268435456');
        await connection.execute('PRAGMA journal_mode=DELETE');
        await connection.execute('PRAGMA synchronous=OFF');

        if (generation !== this.generation) {
          logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
            context: 'setupDb: abandoned mid-setup, closing opened connection',
          });
          closeQuietly(connection);
          return;
        }

        connection.updateHook(() => this.handleUpdate());

        this.connection = connection;
        this.client = connection.createClient({
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
        logger.log('SQLite database opened at', connection.getDbPath());
      } catch (e) {
        // Only ours to close while it is still unpublished; once it is on
        // `this.connection` the stale-connection reset above owns it.
        if (connection !== this.connection) {
          closeQuietly(connection);
        }
        this.throwIfAbandoned(generation, 'setupDb');
        logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
          context: 'setupDb: error setting up db',
          error: e,
          errorMessage: e.message,
          severity: AnalyticsSeverity.Critical,
        });
        throw e;
      }
    })();
    this.setupPromise = setupPromise;

    try {
      await setupPromise;
    } finally {
      // A newer generation owns `setupPromise` now; clearing it here would
      // strand the setup that replaced this one.
      if (generation === this.generation) {
        this.setupPromise = null;
      }
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

  // `generation` defaults to the current one for the public callers (the dev
  // menu, `resetDb`), which have no attempt of their own; `runMigrationsInternal`
  // passes its own so an abandoned attempt can't finish this purge.
  async purgeDb(generation: number = this.generation) {
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
      // Before the delete, not after: these cursors live in AsyncStorage, so
      // emptying the database doesn't touch them. Reset last, a purge that
      // stopped here left an empty database with pre-purge cursors, and the
      // next session skipped the historical and initial-post sync and came up
      // silently missing data.
      if (this.resetSyncStateOnPurge) {
        await resetDbSyncState();
      }

      // That reset is this method's only await, so this is the one point an
      // abandoning deadline can land mid-purge -- and everything past it is
      // destructive. By now a replacement may have adopted this very connection
      // (`setupDb` short-circuits while it is still published) and migrated it,
      // so closing and deleting would take the database out from under a
      // running app. Stopping here instead leaves an intact database with reset
      // cursors, which over-syncs rather than under-syncing.
      this.throwIfAbandoned(generation, 'purgeDb');

      this.connection.close();
      this.connection.delete();
      this.connection = null;
      this.client = null;
      this.didMigrate = false;

      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'purgeDb: closed the connection, cleared the client',
      });

      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'purgeDb: completed purge, recreating',
      });
      await this.setupDb();
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'purgeDb: post-purge setup complete',
      });
    } catch (e) {
      // `purgeDb` is public and has no generation of its own, so it recognises
      // an abandoned initialization unwinding through it by the error type.
      if (e instanceof DbInitAbandonedError) {
        throw e;
      }
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        context: 'purgeDb: error purging db',
        error: e,
        errorMessage: e.message,
        severity: AnalyticsSeverity.Critical,
      });
      throw e;
    }
  }

  async getDbPath(): Promise<string | undefined> {
    return this.connection?.getDbPath();
  }

  async exportDb(destinationPath: string): Promise<void> {
    await this.ensureDbReady();

    if (!this.connection) {
      throw new Error('exportDb: attempted before connection was set up');
    }

    await this.connection.execute(
      `VACUUM INTO '${destinationPath.replace(/'/g, "''")}'`
    );
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

    const generation = this.generation;

    const readyPromise = (async () => {
      await this.setupDb();
      this.throwIfAbandoned(generation, 'ensureDbReady');
      if (!this.didMigrate) {
        await this.runMigrationsInternal(generation);
      }
    })();
    this.readyPromise = readyPromise;

    try {
      await readyPromise;
    } finally {
      // A newer generation owns `readyPromise` now; clearing it here would
      // strand the initialization that replaced this one.
      if (generation === this.generation) {
        this.readyPromise = null;
      }
    }
  }

  /**
   * Detach the in-flight initialization so the next `ensureDbReady` starts a
   * fresh one rather than awaiting work that may never settle.
   *
   * The abandoned attempt keeps running -- nothing here can cancel native work
   * -- but the generation bump makes every shared-state write it has left
   * inert, so it can't publish a connection over its replacement or, worse,
   * reach its purge and delete the database file out from under one.
   *
   * Returns whether there was anything in flight to abandon.
   */
  abandonDbInit(): boolean {
    if (!this.readyPromise && !this.setupPromise) {
      return false;
    }

    this.generation += 1;
    this.readyPromise = null;
    this.setupPromise = null;

    logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
      context: 'abandonDbInit: detached in-flight db initialization',
      generation: this.generation,
      severity: AnalyticsSeverity.Low,
    });

    return true;
  }

  private throwIfAbandoned(generation: number, context: string) {
    if (generation === this.generation) {
      return;
    }
    throw new DbInitAbandonedError(context);
  }

  async runMigrations() {
    await this.ensureDbReady();
    if (!this.didMigrate) {
      throw new Error(
        'runMigrations: completed without recording successful migration'
      );
    }
  }

  private async verifyRequiredTables(
    generation: number,
    opts?: {
      attemptId?: string;
      elapsedMs?: () => number;
      migrationPhase?: 'initial' | 'retry';
    }
  ) {
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
      // A probe can fail because the replacement closed or deleted this
      // connection out from under us. That is abandonment, not a broken schema,
      // and it must not page.
      this.throwIfAbandoned(generation, 'runMigrations');

      const error = new Error(
        `runMigrations: schema health check failed. Missing required tables: ${missingTables.join(
          ', '
        )}`
      );
      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        context: 'runMigrations: schema health check failed',
        error,
        errorMessage: error.message,
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

  private async runMigrationsInternal(generation: number) {
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
        error,
        errorMessage: error.message,
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

      // Rechecked after every await from here on, not just once: the deadline
      // can land in any of these gaps, and past this point `this.connection`
      // may already be the replacement's. Declaring `didMigrate` on its behalf
      // is the damaging one -- the replacement skips migrations entirely and
      // the app runs on an unmigrated database.
      this.throwIfAbandoned(generation, 'runMigrations');

      await this.verifyRequiredTables(generation, {
        attemptId,
        elapsedMs: getElapsedMs,
        migrationPhase,
      });
      this.throwIfAbandoned(generation, 'runMigrations');

      await this.connection.execute(TRIGGER_SETUP);
      this.throwIfAbandoned(generation, 'runMigrations');

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
      // A replacement initialization owns the database now. Falling through
      // would purge and delete the file out from under it, so stop here -- and
      // don't report an abandoned attempt as a migration failure.
      this.throwIfAbandoned(generation, 'runMigrations');

      // The initial attempt failing is recovered by design: the repo keeps a
      // single regenerated baseline migration, so on every existing install
      // drizzle replays it against a populated DB and collides, and purging and
      // re-migrating is the only route that install has to the new schema.
      // Nothing downstream branches on why this attempt failed -- every error
      // falls through to the same purge and retry -- and a failure that is not
      // recovered is reported Critical and rethrown by the purge and retry
      // catches below. So count this at Low rather than paging on it.
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'runMigrations: initial migrate failed. Purging and retrying',
        error: e,
        errorMessage: e.message,
        attemptId,
        elapsedMs: getElapsedMs(),
        migrationPhase: 'initial',
        severity: AnalyticsSeverity.Low,
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
      await this.purgeDb(generation);
      logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
        context: 'runMigrations: retry purge success',
        attemptId,
        elapsedMs: getElapsedMs(),
      });
    } catch (e) {
      this.throwIfAbandoned(generation, 'runMigrations');

      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        context: 'runMigrations: retry purge failed',
        error: e,
        errorMessage: e.message,
        attemptId,
        elapsedMs: getElapsedMs(),
        severity: AnalyticsSeverity.Critical,
      });
      throw e;
    }

    this.throwIfAbandoned(generation, 'runMigrations');

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
      // Same as the initial catch: a late settlement after the user pressed
      // retry is the intended control flow, not a production migration failure
      // worth paging on.
      this.throwIfAbandoned(generation, 'runMigrations');

      logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
        context: 'runMigrations: retry migrate failed',
        error: e,
        errorMessage: e.message,
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
export const abandonDbInit = () => nativeDb.abandonDbInit();
export const purgeDb = () => nativeDb.purgeDb();
export const getDbPath = () => nativeDb.getDbPath();
export const exportDb = (destinationPath: string) =>
  nativeDb.exportDb(destinationPath);
export const resetDb = () => nativeDb.resetDb();
export const runMigrations = () => nativeDb.runMigrations();
export const useMigrations = () => useMigrationsBase(nativeDb);
