import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebDb } from './webDb';

type SqlocalOptions = {
  databasePath: string;
  verbose: boolean;
  onConnect: () => void;
};

const sqlocalRuntime = vi.hoisted(() => {
  // Whether the constructed instance ever calls `onConnect`. SQLocal calls it
  // asynchronously once the WASM driver is up; a driver that never loads is
  // what the init timeout exists for.
  let shouldConnect = true;
  let sqlBehavior: (query: unknown) => Promise<unknown> = async () => [];
  let deleteBehavior: () => Promise<void> = async () => undefined;

  const makeInstance = (options: SqlocalOptions) => ({
    options,
    driver: { __driver: true },
    sql: vi.fn((query: unknown) => sqlBehavior(query)),
    createCallbackFunction: vi.fn(async () => undefined),
    getDatabaseInfo: vi.fn(async () => ({
      databasePath: ':memory:',
      databaseSizeBytes: 1024,
    })),
    overwriteDatabaseFile: vi.fn(async () => undefined),
    deleteDatabaseFile: vi.fn(() => deleteBehavior()),
    getDatabaseFile: vi.fn(async () => null),
    destroy: vi.fn(async () => undefined),
  });

  const instances: ReturnType<typeof makeInstance>[] = [];

  const create = (options: SqlocalOptions) => {
    const instance = makeInstance(options);
    instances.push(instance);
    if (shouldConnect) {
      // Mirror the real driver: onConnect never fires synchronously.
      queueMicrotask(() => options.onConnect());
    }
    return instance;
  };

  return {
    create,
    instances,
    setShouldConnect: (value: boolean) => {
      shouldConnect = value;
    },
    setSqlBehavior: (behavior: (query: unknown) => Promise<unknown>) => {
      sqlBehavior = behavior;
    },
    setDeleteBehavior: (behavior: () => Promise<void>) => {
      deleteBehavior = behavior;
    },
    reset: () => {
      instances.length = 0;
      shouldConnect = true;
      sqlBehavior = async () => [];
      deleteBehavior = async () => undefined;
    },
  };
});

const loggerSpies = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const sharedDbSpies = vi.hoisted(() => ({
  setClient: vi.fn(),
  getSqliteContent: vi.fn(async () => null as ArrayBuffer | null),
  resetValue: vi.fn(async () => undefined),
}));

const webMigratorSpies = vi.hoisted(() => ({
  migrate: vi.fn(async () => ({ applied: [] as string[] })),
}));

vi.mock('sqlocal/drizzle', () => ({
  SQLocalDrizzle: function MockSQLocalDrizzle(options: SqlocalOptions) {
    return sqlocalRuntime.create(options);
  },
}));

vi.mock('drizzle-orm/sqlite-proxy', () => ({
  drizzle: vi.fn(() => ({ __client: true })),
}));

vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { ErrorWebDb: 'ErrorWebDb' },
  AnalyticsSeverity: { Critical: 'Critical' },
  createDevLogger: () => loggerSpies,
}));

vi.mock('@tloncorp/shared/perfLog', () => ({
  perfMark: () => () => undefined,
}));

vi.mock('@tloncorp/shared/db', () => ({
  changesSyncedAt: { resetValue: sharedDbSpies.resetValue },
  didSyncInitialPosts: { resetValue: sharedDbSpies.resetValue },
  handleChange: vi.fn(),
  headsSyncedAt: { resetValue: sharedDbSpies.resetValue },
  schema: {},
  setClient: sharedDbSpies.setClient,
  sqliteContent: {
    getValue: sharedDbSpies.getSqliteContent,
    setValue: vi.fn(async () => undefined),
    resetValue: sharedDbSpies.resetValue,
  },
  userHasCompletedFirstSync: { resetValue: sharedDbSpies.resetValue },
}));

vi.mock('@tloncorp/shared/db/migrations', () => ({
  migrations: { journal: { entries: [] }, migrations: {} },
}));

vi.mock('@tloncorp/shared/utils', () => ({
  readArrayBufferFromBlob: vi.fn(async () => new ArrayBuffer(0)),
}));

vi.mock('./webMigrator', () => ({
  default: webMigratorSpies.migrate,
}));

const errorEvents = () =>
  loggerSpies.trackEvent.mock.calls.filter(([event]) => event === 'ErrorWebDb');

const onlyErrorEvent = () => {
  const events = errorEvents();
  expect(events).toHaveLength(1);
  return events[0][1] as Record<string, unknown>;
};

const failingSql = async () => {
  throw new Error('PRAGMA failed');
};

describe('WebDb', () => {
  beforeEach(() => {
    sqlocalRuntime.reset();
    loggerSpies.trackEvent.mockClear();
    loggerSpies.log.mockClear();
    loggerSpies.warn.mockClear();
    sharedDbSpies.setClient.mockClear();
    sharedDbSpies.getSqliteContent.mockResolvedValue(null);
    webMigratorSpies.migrate.mockClear();
    webMigratorSpies.migrate.mockResolvedValue({ applied: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers the shared client on a successful setup', async () => {
    const db = new WebDb({ enableStoragePersistence: false });

    await db.setupDb();

    expect(sharedDbSpies.setClient).toHaveBeenCalledTimes(1);
    expect(errorEvents()).toHaveLength(0);
  });

  it('reports a setup failure without throwing, so the splash screen stays up', async () => {
    sqlocalRuntime.setSqlBehavior(failingSql);
    const db = new WebDb({ enableStoragePersistence: false });

    await expect(db.setupDb()).resolves.toBeUndefined();

    expect(sharedDbSpies.setClient).not.toHaveBeenCalled();
    expect(onlyErrorEvent()).toMatchObject({
      context: 'setupDb: failed to set up SQLite db',
      phase: 'configure',
      clientRegistered: false,
      errorMessage: 'PRAGMA failed',
      severity: 'Critical',
    });
  });

  it('reports the connect phase when the driver never comes up', async () => {
    vi.useFakeTimers();
    sqlocalRuntime.setShouldConnect(false);
    const db = new WebDb({ enableStoragePersistence: false });

    const setup = db.setupDb();
    await vi.advanceTimersByTimeAsync(15000);
    await setup;

    expect(sharedDbSpies.setClient).not.toHaveBeenCalled();
    expect(onlyErrorEvent()).toMatchObject({
      phase: 'connect',
      clientRegistered: false,
      errorMessage: 'SQLocal init timed out',
    });
  });

  it('reports the phase when loading a persisted database fails', async () => {
    sharedDbSpies.getSqliteContent.mockResolvedValue(new ArrayBuffer(8));
    sqlocalRuntime.setSqlBehavior(failingSql);
    sqlocalRuntime.setDeleteBehavior(async () => {
      throw new Error('deleteDatabaseFile failed');
    });
    const db = new WebDb({ enableStoragePersistence: true });

    await db.setupDb();

    expect(onlyErrorEvent()).toMatchObject({
      phase: 'load-persisted',
      clientRegistered: false,
      storagePersistenceEnabled: true,
      errorMessage: 'deleteDatabaseFile failed',
    });
  });

  it('reports when migrations run without a database, and skips migrating', async () => {
    const db = new WebDb({ enableStoragePersistence: false });

    await db.runMigrations();

    expect(webMigratorSpies.migrate).not.toHaveBeenCalled();
    expect(onlyErrorEvent()).toMatchObject({
      context: 'runMigrations: called without a database',
      hasClient: false,
      hasSqlocal: false,
      severity: 'Critical',
    });
  });

  it('runs migrations once the database is set up', async () => {
    const db = new WebDb({ enableStoragePersistence: false });
    await db.setupDb();

    await db.runMigrations();

    expect(webMigratorSpies.migrate).toHaveBeenCalledTimes(1);
    expect(errorEvents()).toHaveLength(0);
  });
});
