import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockConnection = {
  close: ReturnType<typeof vi.fn>;
  createClient: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  getDbPath: ReturnType<typeof vi.fn>;
  migrateClient: ReturnType<typeof vi.fn>;
  updateHook: ReturnType<typeof vi.fn>;
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
      select: vi.fn(() => ({ from: vi.fn(() => ({ all: vi.fn(async () => []) })) })),
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
  resetHeadsSyncedAt: vi.fn(async () => undefined),
  resetChangesSyncedAt: vi.fn(async () => undefined),
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
  },
  createDevLogger: () => loggerSpies,
  escapeLog: (value: string) => value,
}));

vi.mock('@tloncorp/shared/db', () => ({
  changesSyncedAt: { resetValue: sharedDbSpies.resetChangesSyncedAt },
  handleChange: vi.fn(),
  headsSyncedAt: { resetValue: sharedDbSpies.resetHeadsSyncedAt },
  schema: {
    activityEvents: 'activity_events',
    channels: 'channels',
    groups: 'groups',
    posts: 'posts',
  },
  setClient: sharedDbSpies.setClient,
}));

vi.mock('@op-engineering/op-sqlite', () => ({
  open: sqliteRuntime.open,
}));

vi.mock('./opsqliteConnection', () => ({
  OPSQLite$SQLiteConnection: function MockOPSQLiteConnection() {
    return sqliteRuntime.nextConnection();
  },
}));

import {
  NativeDb,
  ensureDbReady as ensureSingletonDbReady,
  getDbPath as getSingletonDbPath,
  purgeDb as purgeSingletonDb,
  runMigrations as runSingletonMigrations,
  setupDb as setupSingletonDb,
} from './nativeDb';
import { TRIGGER_SETUP } from './triggers';

type NativeDbInternals = {
  client: object | null;
  connection: MockConnection | null;
  didMigrate: boolean;
  processChanges: () => Promise<void>;
  runMigrationsInternal: () => Promise<void>;
  verifyRequiredTables: (opts?: {
    attemptId?: string;
    elapsedMs?: () => number;
    migrationPhase?: 'initial' | 'retry';
  }) => Promise<void>;
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
    expect(connection.execute).toHaveBeenCalledWith('PRAGMA mmap_size=268435456');
    expect(connection.execute).toHaveBeenCalledWith('PRAGMA journal_mode=DELETE');
    expect(connection.execute).toHaveBeenCalledWith('PRAGMA synchronous=OFF');
    expect(connection.updateHook).toHaveBeenCalledTimes(1);
    expect(connection.createClient).toHaveBeenCalledTimes(1);
    expect(sharedDbSpies.setClient).toHaveBeenCalledTimes(1);
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
      migrateClient: vi.fn().mockRejectedValue(new Error('initial migrate failed')),
    });
    const secondConnection = sqliteRuntime.makeConnection();
    sqliteRuntime.enqueueConnection(firstConnection);
    sqliteRuntime.enqueueConnection(secondConnection);
    const db = new NativeDb();

    await db.runMigrations();

    expect(firstConnection.migrateClient).toHaveBeenCalledTimes(1);
    expect(firstConnection.close).toHaveBeenCalledTimes(1);
    expect(firstConnection.delete).toHaveBeenCalledTimes(1);
    expect(secondConnection.migrateClient).toHaveBeenCalledTimes(1);
    expect(sharedDbSpies.setClient).toHaveBeenCalledTimes(2);
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
      delete: vi.fn(() => {
        throw new Error('delete failed');
      }),
      migrateClient: vi.fn().mockRejectedValue(new Error('initial migrate failed')),
    });
    sqliteRuntime.enqueueConnection(firstConnection);
    const db = new NativeDb();

    await expect(db.runMigrations()).rejects.toThrow('delete failed');
  });

  it('throws if retry migrate attempt also fails', async () => {
    const firstConnection = sqliteRuntime.makeConnection({
      migrateClient: vi.fn().mockRejectedValue(new Error('initial migrate failed')),
    });
    const secondConnection = sqliteRuntime.makeConnection({
      migrateClient: vi.fn().mockRejectedValue(new Error('retry migrate failed')),
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
    await expect(internals(db).verifyRequiredTables()).rejects.toThrow(
      'runMigrations: schema check attempted without connection'
    );
  });

  it('singleton export helpers delegate to NativeDb instance methods', async () => {
    const setupSpy = vi.spyOn(NativeDb.prototype, 'setupDb').mockResolvedValue(undefined);
    const ensureSpy = vi
      .spyOn(NativeDb.prototype, 'ensureDbReady')
      .mockResolvedValue(undefined);
    const purgeSpy = vi.spyOn(NativeDb.prototype, 'purgeDb').mockResolvedValue(undefined);
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
