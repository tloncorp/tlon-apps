import { open } from '@op-engineering/op-sqlite';
import { AnalyticsEvent, AnalyticsSeverity, escapeLog } from '@tloncorp/shared';
import { schema, setClient } from '@tloncorp/shared/db';
import { migrations } from '@tloncorp/shared/db/migrations';
import { getTableName, sql } from 'drizzle-orm';

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

// The table drizzle records applied migrations in. It creates this itself as the
// first step of `migrate` (drizzle-orm/sqlite-core/dialect.js), so before the
// first migrate on a fresh DB it does not exist yet.
export const DRIZZLE_MIGRATIONS_TABLE = '__drizzle_migrations';

// The newest `when` in the bundled journal. drizzle replays a migration when the
// DB's recorded `created_at` is older than this and nothing else -- it never
// compares hashes on op-sqlite (drizzle-orm/op-sqlite/migrator.js hardcodes
// `hash: ''`).
export const BUNDLED_MIGRATION_WHEN = migrations.journal.entries.reduce(
  (newest, entry) => Math.max(newest, entry.when),
  Number.NEGATIVE_INFINITY
);

// `packages/shared/reset-migrations.js` keeps exactly one baseline migration and
// regenerates it on every schema change, which bumps the journal's `when`. So on
// every existing install drizzle replays the whole baseline against a populated
// DB and dies on the first `CREATE TABLE`. Purging and re-migrating is the only
// route such an install has to the new schema -- it is the designed upgrade
// path, not a failure, so it should not be reported as a Critical error.
//
// A collision on its own does not prove that, though: a populated DB whose
// `__drizzle_migrations` is missing or empty (a partial prior migration, a lost
// journal) raises the identical message without any upgrade having happened, and
// that state is worth paging on. So the downgrade also requires drizzle's own
// replay evidence -- a recorded `created_at` older than the bundled journal's
// `when`, which is exactly the condition under which drizzle re-runs a baseline.
//
// The message is matched conservatively: op-sqlite prefixes errors raised while
// running a query with `[op-sqlite] sqlite query error: ` (cpp/bridge.cpp; it
// uses other prefixes for other failures), and neither drizzle nor op-sqlite's
// transaction wrapper rewraps it, so only a table collision in that exact shape
// qualifies. Everything else keeps the Critical path.
const EXPECTED_BASELINE_REPLAY_COLLISION =
  /^\[op-sqlite\] sqlite query error: table .+ already exists$/;

export function isExpectedBaselineReplay(
  error: unknown,
  recordedMigrationWhen: number | null
): boolean {
  if (
    recordedMigrationWhen === null ||
    recordedMigrationWhen >= BUNDLED_MIGRATION_WHEN
  ) {
    return false;
  }
  const message = (error as { message?: unknown } | null | undefined)?.message;
  return (
    typeof message === 'string' &&
    EXPECTED_BASELINE_REPLAY_COLLISION.test(message.trim())
  );
}

type NativeDbOptions = {
  databaseName?: string;
  resetSyncStateOnPurge?: boolean;
};

export class NativeDb extends BaseDb {
  private connection: SQLiteConnection | null = null;
  private isProcessingChanges: boolean = false;
  private changesPending: boolean = false;
  private didMigrate: boolean = false;
  private setupPromise: Promise<void> | null = null;
  private readyPromise: Promise<void> | null = null;
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
          open({ location: 'default', name: this.databaseName })
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
          error: e,
          errorMessage: e.message,
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

      if (this.resetSyncStateOnPurge) {
        // reset values related to tracking db sync state
        await resetDbSyncState();
      }

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

  /**
   * The newest `created_at` drizzle has recorded in `__drizzle_migrations`, or
   * `null` when there is no such record to read. Must be called before
   * `migrate`, which creates the table and writes to it. A fresh DB has no such
   * table and the read throws; any failure is treated as "no evidence", so a
   * collision from an install with no migration history keeps the Critical path.
   */
  private async readRecordedMigrationWhen(): Promise<number | null> {
    try {
      const rows = await this.client.values(
        sql`SELECT max(created_at) FROM ${sql.identifier(
          DRIZZLE_MIGRATIONS_TABLE
        )}`
      );
      const recorded = rows?.[0]?.[0];
      // `max()` over an empty table returns a single NULL row, which is an
      // install with no recorded migration -- not evidence of a prior baseline.
      return typeof recorded === 'number' && Number.isFinite(recorded)
        ? recorded
        : null;
    } catch {
      return null;
    }
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

      await this.verifyRequiredTables({
        attemptId,
        elapsedMs: getElapsedMs,
        migrationPhase,
      });
      await this.connection.execute(TRIGGER_SETUP);
      this.didMigrate = true;
    };

    // Read before the first migrate: `migrate` creates and writes this table
    // itself, so afterwards it no longer says what the install arrived with.
    const recordedMigrationWhen = await this.readRecordedMigrationWhen();

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
      if (isExpectedBaselineReplay(e, recordedMigrationWhen)) {
        logger.trackEvent(AnalyticsEvent.NativeDbDebug, {
          context:
            'runMigrations: baseline replayed against populated DB (expected schema upgrade). Purging and retrying',
          error: e,
          errorMessage: e.message,
          recordedMigrationWhen,
          attemptId,
          elapsedMs: getElapsedMs(),
          migrationPhase: 'initial',
          severity: AnalyticsSeverity.Low,
        });
      } else {
        logger.trackEvent(AnalyticsEvent.ErrorNativeDb, {
          context:
            'runMigrations: migration/schema verification failed. Attempting to purge and retry',
          error: e,
          errorMessage: e.message,
          attemptId,
          elapsedMs: getElapsedMs(),
          migrationPhase: 'initial',
          severity: AnalyticsSeverity.Critical,
        });
      }
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
        error: e,
        errorMessage: e.message,
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
export const purgeDb = () => nativeDb.purgeDb();
export const getDbPath = () => nativeDb.getDbPath();
export const exportDb = (destinationPath: string) =>
  nativeDb.exportDb(destinationPath);
export const resetDb = () => nativeDb.resetDb();
export const runMigrations = () => nativeDb.runMigrations();
export const useMigrations = () => useMigrationsBase(nativeDb);
