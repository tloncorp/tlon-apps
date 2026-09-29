import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DbInitAbandonedError,
  NativeDb,
  abandonDbInit as abandonSingletonDbInit,
  ensureDbReady as ensureSingletonDbReady,
  getDbPath as getSingletonDbPath,
  purgeDb as purgeSingletonDb,
  runMigrations as runSingletonMigrations,
  setupDb as setupSingletonDb,
} from './nativeDb';
import { TRIGGER_SETUP } from './triggers';

type MockConnection = {
  close: Mock<any, any>;
  createClient: Mock<any, any>;
  delete: Mock<any, any>;
  execute: Mock<any, any>;
  getDbPath: Mock<any, any>;
  migrateClient: Mock<any, any>;
  updateHook: Mock<any, any>;
};

type TrackPayload = Record<string, unknown>;

const sqliteRuntime = vi.hoisted(() => {
  const open = vi.fn(() => ({ __db: true }));
  const constructor = vi.fn();
  const queuedConnections: MockConnection[] = [];
  const createdConnections: MockConnection[] = [];

  const makeConnection = (
    overrides: Partial<MockConnection> = {}
  ): MockConnection => ({
    close: vi.fn(),
    createClient: vi.fn(() => ({
      delete: vi.fn(() => ({ run: vi.fn(async () => undefined) })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({ all: vi.fn(async () => []) })),
      })),
    })),
    delete: vi.fn(),
    execute: vi.fn(async () => undefined),
    getDbPath: vi.fn(() => '/tmp/tlon.sqlite'),
    migrateClient: vi.fn(async () => undefined),
    updateHook: vi.fn(),
    ...overrides,
  });

  const enqueueConnection = (connection?: MockConnection) => {
    const nextConnection = connection ?? makeConnection();
    queuedConnections.push(nextConnection);
    return nextConnection;
  };

  const nextConnection = (): MockConnection => {
    const connection = queuedConnections.shift() ?? makeConnection();
    createdConnections.push(connection);
    constructor();
    return connection;
  };

  const reset = () => {
    open.mockReset();
    open.mockReturnValue({ __db: true });
    constructor.mockReset();
    queuedConnections.length = 0;
    createdConnections.length = 0;
  };

  return {
    constructor,
    createdConnections,
    enqueueConnection,
    makeConnection,
    nextConnection,
    open,
    reset,
  };
});

const loggerSpies = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  log: vi.fn(),
  error: vi.fn(),
}));

const sharedDbSpies = vi.hoisted(() => ({
  resetDidSyncInitialPosts: vi.fn(async () => undefined),
  resetHeadsSyncedAt: vi.fn(async () => undefined),
  resetChangesSyncedAt: vi.fn(async () => undefined),
  resetUserHasCompletedFirstSync: vi.fn(async () => undefined),
  setClient: vi.fn(),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    getTableName: (table: unknown) => String(table),
  };
});

vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: {
    ErrorNativeDb: 'ErrorNativeDb',
    NativeDbDebug: 'NativeDbDebug',
  },
  AnalyticsSeverity: {
    Critical: 'Critical',
    Low: 'Low',
  },
  createDevLogger: () => loggerSpies,
  escapeLog: (value: string) => value,
}));

vi.mock('@tloncorp/shared/db', () => ({
  changesSyncedAt: { resetValue: sharedDbSpies.resetChangesSyncedAt },
  didSyncInitialPosts: { resetValue: sharedDbSpies.resetDidSyncInitialPosts },
  handleChange: vi.fn(),
  headsSyncedAt: { resetValue: sharedDbSpies.resetHeadsSyncedAt },
  schema: {
    activityEvents: 'activity_events',
    channels: 'channels',
    groups: 'groups',
    posts: 'posts',
  },
  setClient: sharedDbSpies.setClient,
  userHasCompletedFirstSync: {
    resetValue: sharedDbSpies.resetUserHasCompletedFirstSync,
  },
}));

vi.mock('@op-engineering/op-sqlite', () => ({
  open: sqliteRuntime.open,
}));

vi.mock('./opsqliteConnection', () => ({
  OPSQLite$SQLiteConnection: function MockOPSQLiteConnection() {
    return sqliteRuntime.nextConnection();
  },
}));

type NativeDbInternals = {
  client: object | null;
  connection: MockConnection | null;
  didMigrate: boolean;
  processChanges: () => Promise<void>;
  runMigrationsInternal: (generation: number) => Promise<void>;
  verifyRequiredTables: (
    generation: number,
    opts?: {
      attemptId?: string;
      elapsedMs?: () => number;
      migrationPhase?: 'initial' | 'retry';
    }
  ) => Promise<void>;
};

function internals(db: NativeDb): NativeDbInternals {
  return db as unknown as NativeDbInternals;
}

function eventPayloads(): TrackPayload[] {
  return loggerSpies.trackEvent.mock.calls.map(
    ([, payload]) => payload as TrackPayload
  );
}

function findPayload(
  matcher: (payload: TrackPayload) => boolean
): TrackPayload | undefined {
  return eventPayloads().find(matcher);
}

function findEvent(
  matcher: (event: string, payload: TrackPayload) => boolean
): [string, TrackPayload] | undefined {
  return loggerSpies.trackEvent.mock.calls.find(([event, payload]) =>
    matcher(event as string, (payload ?? {}) as TrackPayload)
  ) as [string, TrackPayload] | undefined;
}

const BASELINE_COLLISION_MESSAGE =
  '[op-sqlite] sqlite query error: table `activity_event_contact_group_pins` already exists';

describe('NativeDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqliteRuntime.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('setupDb initializes connection, pragmas, hooks, and client', async () => {
    const connection = sqliteRuntime.makeConnection();
    sqliteRuntime.enqueueConnection(connection);
    const db = new NativeDb();

    await db.setupDb();

    expect(sqliteRuntime.constructor).toHaveBeenCalledTimes(1);
    expect(sqliteRuntime.open).toHaveBeenCalledWith({
      location: 'default',
      name: 'tlon.sqlite',
    });
    expect(connection.execute).toHaveBeenCalledWith(
      'PRAGMA mmap_size=268435456'
    );
    expect(connection.execute).toHaveBeenCalledWith(
      'PRAGMA journal_mode=DELETE'
    );
    expect(connection.execute).toHaveBeenCalledWith('PRAGMA synchronous=OFF');
    expect(connection.updateHook).toHaveBeenCalledTimes(1);
    expect(connection.createClient).toHaveBeenCalledTimes(1);
    expect(sharedDbSpies.setClient).toHaveBeenCalledTimes(1);
  });

  it('supports an isolated database without resetting app sync state', async () => {
    const firstConnection = sqliteRuntime.makeConnection();
    const secondConnection = sqliteRuntime.makeConnection();
    sqliteRuntime.enqueueConnection(firstConnection);
    sqliteRuntime.enqueueConnection(secondConnection);
    const db = new NativeDb({
      databaseName: 'tlon-cosmos.sqlite',
      resetSyncStateOnPurge: false,
    });

    await db.setupDb();
    await db.purgeDb();

    expect(sqliteRuntime.open).toHaveBeenNthCalledWith(1, {
      location: 'default',
      name: 'tlon-cosmos.sqlite',
    });
    expect(sqliteRuntime.open).toHaveBeenNthCalledWith(2, {
      location: 'default',
      name: 'tlon-cosmos.sqlite',
    });
    expect(firstConnection.delete).toHaveBeenCalledTimes(1);
    // `delete()` closes the connection itself -- closing first would be a
    // second `sqlite3_close_v2` on a freed handle.
    expect(firstConnection.close).not.toHaveBeenCalled();
    expect(sharedDbSpies.resetHeadsSyncedAt).not.toHaveBeenCalled();
    expect(sharedDbSpies.resetChangesSyncedAt).not.toHaveBeenCalled();
    expect(sharedDbSpies.resetDidSyncInitialPosts).not.toHaveBeenCalled();
    expect(sharedDbSpies.resetUserHasCompletedFirstSync).not.toHaveBeenCalled();
  });

  it('setupDb serializes concurrent calls behind one setupPromise', async () => {
    let releaseFirstPragma: (() => void) | undefined;
    const firstPragma = new Promise<void>((resolve) => {
      releaseFirstPragma = resolve;
    });

    const connection = sqliteRuntime.makeConnection({
      execute: vi
        .fn()
        .mockImplementationOnce(() => firstPragma)
        .mockResolvedValue(undefined),
    });
    sqliteRuntime.enqueueConnection(connection);
    const db = new NativeDb();

    const first = db.setupDb();
    const second = db.setupDb();
    await Promise.resolve();

    expect(sqliteRuntime.constructor).toHaveBeenCalledTimes(1);
    releaseFirstPragma?.();
    await Promise.all([first, second]);
    expect(connection.createClient).toHaveBeenCalledTimes(1);
  });

  it('setupDb resets stale connection objects that have no client', async () => {
    const staleConnection = sqliteRuntime.makeConnection();
    const freshConnection = sqliteRuntime.makeConnection();
    sqliteRuntime.enqueueConnection(freshConnection);

    const db = new NativeDb();
    internals(db).connection = staleConnection;
    internals(db).client = null;

    await db.setupDb();

    expect(staleConnection.close).toHaveBeenCalledTimes(1);
    expect(freshConnection.createClient).toHaveBeenCalledTimes(1);
    expect(sharedDbSpies.setClient).toHaveBeenCalledTimes(1);
  });

  it('runMigrations migrates once, validates sentinel tables, and installs triggers', async () => {
    const connection = sqliteRuntime.makeConnection();
    sqliteRuntime.enqueueConnection(connection);
    const db = new NativeDb();

    await db.runMigrations();

    expect(connection.migrateClient).toHaveBeenCalledTimes(1);

    const selectQueries = connection.execute.mock.calls
      .map(([query]) => query as string)
      .filter((query) => query.startsWith('SELECT 1 FROM'));
    expect(selectQueries).toEqual(
      expect.arrayContaining([
        'SELECT 1 FROM "groups" LIMIT 1',
        'SELECT 1 FROM "channels" LIMIT 1',
        'SELECT 1 FROM "posts" LIMIT 1',
        'SELECT 1 FROM "activity_events" LIMIT 1',
      ])
    );
    expect(connection.execute).toHaveBeenCalledWith(TRIGGER_SETUP);

    await db.ensureDbReady();
    await db.runMigrations();
    expect(connection.migrateClient).toHaveBeenCalledTimes(1);
  });

  it('retries through purge/setup when initial migrate fails', async () => {
    const firstConnection = sqliteRuntime.makeConnection({
      migrateClient: vi
        .fn()
        .mockRejectedValue(new Error('initial migrate failed')),
    });
    const secondConnection = sqliteRuntime.makeConnection();
    sqliteRuntime.enqueueConnection(firstConnection);
    sqliteRuntime.enqueueConnection(secondConnection);
    const db = new NativeDb();

    await db.runMigrations();

    expect(firstConnection.migrateClient).toHaveBeenCalledTimes(1);
    expect(firstConnection.close).not.toHaveBeenCalled();
    expect(firstConnection.delete).toHaveBeenCalledTimes(1);
    expect(secondConnection.migrateClient).toHaveBeenCalledTimes(1);
    expect(sharedDbSpies.setClient).toHaveBeenCalledTimes(2);
    expect(sharedDbSpies.resetHeadsSyncedAt).toHaveBeenCalledTimes(1);
    expect(sharedDbSpies.resetChangesSyncedAt).toHaveBeenCalledTimes(1);
    expect(sharedDbSpies.resetDidSyncInitialPosts).toHaveBeenCalledTimes(1);
    expect(sharedDbSpies.resetUserHasCompletedFirstSync).toHaveBeenCalledTimes(
      1
    );
  });

  it('retries through purge/setup when schema health check fails', async () => {
    const firstConnection = sqliteRuntime.makeConnection({
      execute: vi.fn(async (query: string) => {
        if (query === 'SELECT 1 FROM "groups" LIMIT 1') {
          throw new Error('no such table: groups');
        }
      }),
    });
    const secondConnection = sqliteRuntime.makeConnection();
    sqliteRuntime.enqueueConnection(firstConnection);
    sqliteRuntime.enqueueConnection(secondConnection);
    const db = new NativeDb();

    await db.runMigrations();

    expect(firstConnection.migrateClient).toHaveBeenCalledTimes(1);
    expect(secondConnection.migrateClient).toHaveBeenCalledTimes(1);

    const schemaFailure = findPayload(
      (payload) =>
        Array.isArray(payload.missingTables) &&
        payload.missingTables.includes('groups')
    );
    expect(schemaFailure).toBeDefined();
  });

  it('throws if retry purge fails', async () => {
    const firstConnection = sqliteRuntime.makeConnection({
      delete: vi.fn((): void => {
        throw new Error('delete failed');
      }),
      migrateClient: vi
        .fn()
        .mockRejectedValue(new Error('initial migrate failed')),
    });
    sqliteRuntime.enqueueConnection(firstConnection);
    const db = new NativeDb();

    await expect(db.runMigrations()).rejects.toThrow('delete failed');
  });

  it('throws if retry migrate attempt also fails', async () => {
    const firstConnection = sqliteRuntime.makeConnection({
      migrateClient: vi
        .fn()
        .mockRejectedValue(new Error('initial migrate failed')),
    });
    const secondConnection = sqliteRuntime.makeConnection({
      migrateClient: vi
        .fn()
        .mockRejectedValue(new Error('retry migrate failed')),
    });
    sqliteRuntime.enqueueConnection(firstConnection);
    sqliteRuntime.enqueueConnection(secondConnection);
    const db = new NativeDb();

    await expect(db.runMigrations()).rejects.toThrow('retry migrate failed');
    expect(firstConnection.delete).toHaveBeenCalledTimes(1);
  });

  it('uses the real timeout path and then succeeds on retry', async () => {
    vi.useFakeTimers();
    const firstConnection = sqliteRuntime.makeConnection({
      migrateClient: vi.fn(() => new Promise<void>(() => undefined)),
    });
    const secondConnection = sqliteRuntime.makeConnection();
    sqliteRuntime.enqueueConnection(firstConnection);
    sqliteRuntime.enqueueConnection(secondConnection);
    const db = new NativeDb();

    const migration = db.runMigrations();
    await vi.advanceTimersByTimeAsync(5000);
    await migration;

    expect(firstConnection.migrateClient).toHaveBeenCalledTimes(1);
    expect(secondConnection.migrateClient).toHaveBeenCalledTimes(1);
    const timeoutEvent = findPayload(
      (payload) =>
        typeof payload.errorMessage === 'string' &&
        payload.errorMessage.includes('Migration timeout exceeded')
    );
    expect(timeoutEvent).toBeDefined();
  });

  it('runMigrations throws if ensureDbReady resolves without didMigrate', async () => {
    const db = new NativeDb();
    vi.spyOn(db, 'ensureDbReady').mockResolvedValue(undefined);

    await expect(db.runMigrations()).rejects.toThrow(
      'runMigrations: completed without recording successful migration'
    );
  });

  it('ensureDbReady shares in-flight work and no-ops once ready', async () => {
    let resolveMigration: (() => void) | undefined;
    const migrationGate = new Promise<void>((resolve) => {
      resolveMigration = resolve;
    });

    const connection = sqliteRuntime.makeConnection({
      migrateClient: vi.fn(() => migrationGate),
    });
    sqliteRuntime.enqueueConnection(connection);
    const db = new NativeDb();

    const first = db.ensureDbReady();
    const second = db.ensureDbReady();
    resolveMigration?.();
    await Promise.all([first, second]);
    expect(connection.migrateClient).toHaveBeenCalledTimes(1);
    await db.ensureDbReady();
    expect(connection.migrateClient).toHaveBeenCalledTimes(1);
  });

  it('ensureDbReady clears readyPromise after failure so callers can retry', async () => {
    const db = new NativeDb();
    vi.spyOn(db, 'setupDb').mockResolvedValue(undefined);

    const runMigrationsInternalSpy = vi
      .spyOn(internals(db), 'runMigrationsInternal')
      .mockRejectedValue(new Error('migration crashed'));

    const first = db.ensureDbReady();
    const second = db.ensureDbReady();
    await expect(first).rejects.toThrow('migration crashed');
    await expect(second).rejects.toThrow('migration crashed');
    expect(runMigrationsInternalSpy).toHaveBeenCalledTimes(1);

    await expect(db.ensureDbReady()).rejects.toThrow('migration crashed');
    expect(runMigrationsInternalSpy).toHaveBeenCalledTimes(2);
  });

  it('verifyRequiredTables throws when called without a connection', async () => {
    const db = new NativeDb();
    await expect(internals(db).verifyRequiredTables(0)).rejects.toThrow(
      'runMigrations: schema check attempted without connection'
    );
  });

  it('singleton export helpers delegate to NativeDb instance methods', async () => {
    const setupSpy = vi
      .spyOn(NativeDb.prototype, 'setupDb')
      .mockResolvedValue(undefined);
    const ensureSpy = vi
      .spyOn(NativeDb.prototype, 'ensureDbReady')
      .mockResolvedValue(undefined);
    const purgeSpy = vi
      .spyOn(NativeDb.prototype, 'purgeDb')
      .mockResolvedValue(undefined);
    const runSpy = vi
      .spyOn(NativeDb.prototype, 'runMigrations')
      .mockResolvedValue(undefined);
    const getPathSpy = vi
      .spyOn(NativeDb.prototype, 'getDbPath')
      .mockResolvedValue('/tmp/tlon.sqlite');

    try {
      await setupSingletonDb();
      await ensureSingletonDbReady();
      await purgeSingletonDb();
      await runSingletonMigrations();
      await getSingletonDbPath();

      expect(setupSpy).toHaveBeenCalledTimes(1);
      expect(ensureSpy).toHaveBeenCalledTimes(1);
      expect(purgeSpy).toHaveBeenCalledTimes(1);
      expect(runSpy).toHaveBeenCalledTimes(1);
      expect(getPathSpy).toHaveBeenCalledTimes(1);
    } finally {
      setupSpy.mockRestore();
      ensureSpy.mockRestore();
      purgeSpy.mockRestore();
      runSpy.mockRestore();
      getPathSpy.mockRestore();
    }
  });

  it('handleUpdate coalesces overlapping updates into one extra pass', async () => {
    let releaseFirstPass: (() => void) | undefined;
    const firstPass = new Promise<void>((resolve) => {
      releaseFirstPass = resolve;
    });

    let secondPassStarted: (() => void) | undefined;
    const secondPass = new Promise<void>((resolve) => {
      secondPassStarted = resolve;
    });

    const db = new NativeDb();
    const processChangesSpy = vi
      .spyOn(internals(db), 'processChanges')
      .mockImplementationOnce(() => firstPass)
      .mockImplementationOnce(async () => {
        secondPassStarted?.();
      });
    const first = db.handleUpdate();
    const second = db.handleUpdate();
    await Promise.resolve();
    expect(processChangesSpy).toHaveBeenCalledTimes(1);

    releaseFirstPass?.();
    await Promise.all([first, second]);
    await secondPass;
    expect(processChangesSpy).toHaveBeenCalledTimes(2);
  });
});

describe('NativeDb initial migrate reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqliteRuntime.reset();
  });

  function rejectingConnection(message: string) {
    return sqliteRuntime.makeConnection({
      migrateClient: vi.fn().mockRejectedValue(new Error(message)),
    });
  }

  /**
   * Nothing downstream branches on why the initial attempt failed -- every error
   * falls through to the same purge and retry -- so the report is the same event
   * at the same severity whatever the failure was.
   */
  function expectLowInitialFailure(message: string) {
    const initialFailure = findEvent(
      (_event, payload) =>
        payload.context ===
        'runMigrations: initial migrate failed. Purging and retrying'
    );
    expect(initialFailure?.[0]).toBe('NativeDbDebug');
    expect(initialFailure?.[1]).toMatchObject({
      attemptId: expect.any(String),
      elapsedMs: expect.any(Number),
      error: expect.any(Error),
      errorMessage: message,
      migrationPhase: 'initial',
      severity: 'Low',
    });

    expect(findEvent((event) => event === 'ErrorNativeDb')).toBeUndefined();
  }

  it('counts the baseline replay collision without paging, and still purges and retries', async () => {
    const firstConnection = rejectingConnection(BASELINE_COLLISION_MESSAGE);
    const secondConnection = sqliteRuntime.makeConnection();
    sqliteRuntime.enqueueConnection(firstConnection);
    sqliteRuntime.enqueueConnection(secondConnection);
    const db = new NativeDb();

    await db.runMigrations();

    expect(firstConnection.delete).toHaveBeenCalledTimes(1);
    expect(secondConnection.migrateClient).toHaveBeenCalledTimes(1);
    expectLowInitialFailure(BASELINE_COLLISION_MESSAGE);
  });

  it('counts an unrelated initial failure the same way', async () => {
    const firstConnection = rejectingConnection('Migration timeout exceeded');
    const secondConnection = sqliteRuntime.makeConnection();
    sqliteRuntime.enqueueConnection(firstConnection);
    sqliteRuntime.enqueueConnection(secondConnection);
    const db = new NativeDb();

    await db.runMigrations();

    expect(firstConnection.delete).toHaveBeenCalledTimes(1);
    expect(secondConnection.migrateClient).toHaveBeenCalledTimes(1);
    expectLowInitialFailure('Migration timeout exceeded');
  });

  it('reports critically when the failure survives the purge', async () => {
    sqliteRuntime.enqueueConnection(
      rejectingConnection(BASELINE_COLLISION_MESSAGE)
    );
    sqliteRuntime.enqueueConnection(
      rejectingConnection(BASELINE_COLLISION_MESSAGE)
    );
    const db = new NativeDb();

    await expect(db.runMigrations()).rejects.toThrow(
      BASELINE_COLLISION_MESSAGE
    );

    const retryFailure = findEvent(
      (event, payload) =>
        event === 'ErrorNativeDb' && payload.migrationPhase === 'retry'
    );
    expect(retryFailure?.[1]).toMatchObject({
      context: 'runMigrations: retry migrate failed',
      errorMessage: BASELINE_COLLISION_MESSAGE,
      severity: 'Critical',
    });
  });
});

describe('NativeDb abandoned initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqliteRuntime.reset();
  });

  it('is a no-op when there is no initialization in flight', async () => {
    const db = new NativeDb();

    expect(db.abandonDbInit()).toBe('nothing-in-flight');

    await db.ensureDbReady();

    expect(db.abandonDbInit()).toBe('nothing-in-flight');
  });

  it('lets the next ensureDbReady start fresh instead of awaiting the hung one', async () => {
    let releaseMigration: (() => void) | undefined;
    const hungMigration = new Promise<void>((resolve) => {
      releaseMigration = resolve;
    });

    const connection = sqliteRuntime.makeConnection({
      migrateClient: vi
        .fn()
        .mockImplementationOnce(() => hungMigration)
        .mockResolvedValue(undefined),
    });
    sqliteRuntime.enqueueConnection(connection);
    const db = new NativeDb();

    const abandoned = db.ensureDbReady();
    await vi.waitFor(() =>
      expect(connection.migrateClient).toHaveBeenCalledTimes(1)
    );

    expect(db.abandonDbInit()).toBe('abandoned');

    await db.ensureDbReady();

    expect(connection.migrateClient).toHaveBeenCalledTimes(2);
    expect(internals(db).didMigrate).toBe(true);
    // The replacement reuses the published connection rather than opening a
    // second one against the same file.
    expect(sqliteRuntime.constructor).toHaveBeenCalledTimes(1);

    releaseMigration?.();
    await expect(abandoned).rejects.toBeInstanceOf(DbInitAbandonedError);
  });

  it('refuses to abandon while setup owns an unpublished connection', async () => {
    let releasePragma: (() => void) | undefined;
    const hungPragma = new Promise<void>((resolve) => {
      releasePragma = resolve;
    });

    const connection = sqliteRuntime.makeConnection({
      execute: vi
        .fn()
        .mockImplementationOnce(() => hungPragma)
        .mockResolvedValue(undefined),
    });
    sqliteRuntime.enqueueConnection(connection);
    const db = new NativeDb();

    const pending = db.ensureDbReady();
    await vi.waitFor(() => expect(connection.execute).toHaveBeenCalledTimes(1));

    // The handle lives only in the setup call's local here, so there is nothing
    // for a replacement to adopt and nothing safe to close -- this call still
    // has statements out on it. Detaching would leave the replacement to open a
    // second native connection on the same file.
    expect(db.abandonDbInit()).toBe('setup-owns-connection');

    // So the retry joins the initialization that is still attached, rather
    // than opening a second native connection on the same file.
    const retried = db.ensureDbReady();
    sqliteRuntime.enqueueConnection(sqliteRuntime.makeConnection());

    releasePragma?.();
    await Promise.all([pending, retried]);

    expect(sqliteRuntime.constructor).toHaveBeenCalledTimes(1);
    expect(internals(db).connection).toBe(connection);
    expect(internals(db).didMigrate).toBe(true);
  });

  it('does not purge the database the replacement is already using', async () => {
    let failMigration: ((error: Error) => void) | undefined;
    const hungMigration = new Promise<void>((_resolve, reject) => {
      failMigration = reject;
    });

    const connection = sqliteRuntime.makeConnection({
      migrateClient: vi
        .fn()
        .mockImplementationOnce(() => hungMigration)
        .mockResolvedValue(undefined),
    });
    sqliteRuntime.enqueueConnection(connection);
    const db = new NativeDb();

    const abandoned = db.ensureDbReady();
    await vi.waitFor(() =>
      expect(connection.migrateClient).toHaveBeenCalledTimes(1)
    );

    db.abandonDbInit();
    await db.ensureDbReady();
    expect(internals(db).didMigrate).toBe(true);

    failMigration?.(new Error('late migrate failure'));
    await expect(abandoned).rejects.toBeInstanceOf(DbInitAbandonedError);

    // Without the generation check this failure falls through to purgeDb,
    // which closes the connection and deletes the file the replacement just
    // migrated.
    expect(connection.close).not.toHaveBeenCalled();
    expect(connection.delete).not.toHaveBeenCalled();
    expect(
      findPayload(
        (payload) =>
          payload.context ===
          'runMigrations: initial migrate failed. Purging and retrying'
      )
    ).toBeUndefined();
  });

  it('does not declare the replacement ready when abandoned after the migrate', async () => {
    let releaseProbes: (() => void) | undefined;
    const probeGate = new Promise<void>((resolve) => {
      releaseProbes = resolve;
    });

    const connection = sqliteRuntime.makeConnection({
      execute: vi.fn((query: string) =>
        query.startsWith('SELECT 1 FROM') ? probeGate : Promise.resolve()
      ),
    });
    sqliteRuntime.enqueueConnection(connection);
    const db = new NativeDb();

    const abandoned = db.ensureDbReady();
    await vi.waitFor(() =>
      expect(
        connection.execute.mock.calls.some(([query]: [string]) =>
          query.startsWith('SELECT 1 FROM')
        )
      ).toBe(true)
    );

    // The deadline lands after the migrate's own generation check has already
    // passed, while the schema probes are still in flight.
    expect(db.abandonDbInit()).toBe('abandoned');

    releaseProbes?.();
    await expect(abandoned).rejects.toBeInstanceOf(DbInitAbandonedError);

    expect(internals(db).didMigrate).toBe(false);
    expect(connection.execute).not.toHaveBeenCalledWith(TRIGGER_SETUP);
    expect(
      findPayload(
        (payload) =>
          payload.context ===
          'runMigrations: initial migrate failed. Purging and retrying'
      )
    ).toBeUndefined();
  });

  it('does not page when the retry attempt is abandoned mid-migrate', async () => {
    let releaseRetryMigration: (() => void) | undefined;
    const retryMigration = new Promise<void>((resolve) => {
      releaseRetryMigration = resolve;
    });

    const firstConnection = sqliteRuntime.makeConnection({
      migrateClient: vi
        .fn()
        .mockRejectedValue(new Error('initial migrate failed')),
    });
    const retryConnection = sqliteRuntime.makeConnection({
      migrateClient: vi.fn(() => retryMigration),
    });
    sqliteRuntime.enqueueConnection(firstConnection);
    sqliteRuntime.enqueueConnection(retryConnection);
    const db = new NativeDb();

    const abandoned = db.ensureDbReady();
    await vi.waitFor(() =>
      expect(retryConnection.migrateClient).toHaveBeenCalledTimes(1)
    );

    expect(db.abandonDbInit()).toBe('abandoned');

    releaseRetryMigration?.();
    await expect(abandoned).rejects.toBeInstanceOf(DbInitAbandonedError);

    expect(internals(db).didMigrate).toBe(false);
    // Abandonment is intended control flow, so it must not look like a
    // production migration failure.
    expect(
      findEvent(
        (event, payload) =>
          event === 'ErrorNativeDb' &&
          payload.context === 'runMigrations: retry migrate failed'
      )
    ).toBeUndefined();
  });

  it('resets the sync cursors before emptying the database', async () => {
    const firstConnection = sqliteRuntime.makeConnection({
      migrateClient: vi
        .fn()
        .mockRejectedValue(new Error('initial migrate failed')),
    });
    sqliteRuntime.enqueueConnection(firstConnection);
    sqliteRuntime.enqueueConnection(sqliteRuntime.makeConnection());
    const db = new NativeDb();

    await db.runMigrations();

    // The reset is the purge's only await, so it is the only point an
    // abandoning deadline can land mid-purge. Doing it first means that window
    // is an intact database with reset cursors, not an empty database the
    // replacement reads with pre-purge cursors.
    const lastReset =
      sharedDbSpies.resetUserHasCompletedFirstSync.mock.invocationCallOrder[0];
    expect(lastReset).toBeLessThan(
      firstConnection.delete.mock.invocationCallOrder[0]
    );
    // `delete()` is the whole destructive step -- it closes the handle itself,
    // so the purge never calls `close()` separately.
    expect(firstConnection.close).not.toHaveBeenCalled();
  });

  it('does not page for a schema probe that failed because of abandonment', async () => {
    let failProbes: ((error: Error) => void) | undefined;
    const probeGate = new Promise<void>((_resolve, reject) => {
      failProbes = reject;
    });

    const connection = sqliteRuntime.makeConnection({
      execute: vi.fn((query: string) =>
        query.startsWith('SELECT 1 FROM') ? probeGate : Promise.resolve()
      ),
    });
    sqliteRuntime.enqueueConnection(connection);
    const db = new NativeDb();

    const abandoned = db.ensureDbReady();
    await vi.waitFor(() =>
      expect(
        connection.execute.mock.calls.some(([query]: [string]) =>
          query.startsWith('SELECT 1 FROM')
        )
      ).toBe(true)
    );

    expect(db.abandonDbInit()).toBe('abandoned');
    failProbes?.(new Error('database connection closed'));

    await expect(abandoned).rejects.toBeInstanceOf(DbInitAbandonedError);

    // Every probe reports as missing here, but the tables aren't missing --
    // the replacement took the connection away.
    expect(
      findEvent(
        (event, payload) =>
          event === 'ErrorNativeDb' &&
          payload.context === 'runMigrations: schema health check failed'
      )
    ).toBeUndefined();
  });

  it('does not page when an abandoned attempt unwinds through its purge', async () => {
    let releaseReset: (() => void) | undefined;
    const resetGate = new Promise<undefined>((resolve) => {
      releaseReset = () => resolve(undefined);
    });

    const connection = sqliteRuntime.makeConnection({
      migrateClient: vi
        .fn()
        .mockRejectedValueOnce(new Error('initial migrate failed'))
        .mockResolvedValue(undefined),
    });
    sqliteRuntime.enqueueConnection(connection);
    sharedDbSpies.resetHeadsSyncedAt.mockImplementationOnce(() => resetGate);
    const db = new NativeDb();

    const abandoned = db.ensureDbReady();
    await vi.waitFor(() =>
      expect(sharedDbSpies.resetHeadsSyncedAt).toHaveBeenCalledTimes(1)
    );

    expect(db.abandonDbInit()).toBe('abandoned');

    releaseReset?.();
    await expect(abandoned).rejects.toBeInstanceOf(DbInitAbandonedError);

    // The purge stopping on its own generation check is intended control flow,
    // so neither its own catch nor the caller's may report it.
    expect(
      findEvent(
        (event, payload) =>
          event === 'ErrorNativeDb' &&
          payload.context === 'purgeDb: error purging db'
      )
    ).toBeUndefined();
    expect(
      findEvent(
        (event, payload) =>
          event === 'ErrorNativeDb' &&
          payload.context === 'runMigrations: retry purge failed'
      )
    ).toBeUndefined();
  });

  it('does not delete a database the replacement has already adopted', async () => {
    let releaseReset: (() => void) | undefined;
    // Matches the spy's own `Promise<undefined>` return type.
    const resetGate = new Promise<undefined>((resolve) => {
      releaseReset = () => resolve(undefined);
    });

    const connection = sqliteRuntime.makeConnection({
      migrateClient: vi
        .fn()
        .mockRejectedValueOnce(new Error('initial migrate failed'))
        .mockResolvedValue(undefined),
    });
    sqliteRuntime.enqueueConnection(connection);
    sharedDbSpies.resetHeadsSyncedAt.mockImplementationOnce(() => resetGate);
    const db = new NativeDb();

    const abandoned = db.ensureDbReady();
    await vi.waitFor(() =>
      expect(sharedDbSpies.resetHeadsSyncedAt).toHaveBeenCalledTimes(1)
    );

    expect(db.abandonDbInit()).toBe('abandoned');

    // The purge hasn't reached its close yet, so the connection is still
    // published and the replacement adopts it rather than opening its own.
    await db.ensureDbReady();
    expect(internals(db).didMigrate).toBe(true);
    expect(sqliteRuntime.constructor).toHaveBeenCalledTimes(1);

    releaseReset?.();
    await expect(abandoned).rejects.toBeInstanceOf(DbInitAbandonedError);

    // The abandoned purge resuming here would close and delete the database
    // the replacement just migrated and is now serving the app from.
    expect(connection.close).not.toHaveBeenCalled();
    expect(connection.delete).not.toHaveBeenCalled();
    expect(internals(db).connection).toBe(connection);
    expect(internals(db).didMigrate).toBe(true);
  });

  it('exposes abandonDbInit on the singleton', () => {
    const abandonSpy = vi
      .spyOn(NativeDb.prototype, 'abandonDbInit')
      .mockReturnValue('abandoned');

    try {
      expect(abandonSingletonDbInit()).toBe('abandoned');
      expect(abandonSpy).toHaveBeenCalledTimes(1);
    } finally {
      abandonSpy.mockRestore();
    }
  });
});
