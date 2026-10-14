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
  // SQLocal's origin-wide `_sqlocal_mutation_(:memory:)` Web Lock. destroy()
  // on an instance that never connected takes it and never settles, so every
  // later overwriteDatabaseFile, on any instance, waits forever.
  let mutationLockLeaked = false;
  const never = () => new Promise<never>(() => undefined);

  const makeInstance = (options: SqlocalOptions) => {
    const instance = {
      options,
      connected: false,
      connect: () => {
        instance.connected = true;
        options.onConnect();
      },
      driver: { __driver: true },
      sql: vi.fn((query: unknown) => sqlBehavior(query)),
      createCallbackFunction: vi.fn(async () => undefined),
      getDatabaseInfo: vi.fn(async () => ({
        databasePath: ':memory:',
        databaseSizeBytes: 1024,
      })),
      overwriteDatabaseFile: vi.fn(() =>
        mutationLockLeaked ? never() : Promise.resolve()
      ),
      deleteDatabaseFile: vi.fn(() => deleteBehavior()),
      getDatabaseFile: vi.fn(async () => null),
      destroy: vi.fn(() => {
        if (!instance.connected) {
          mutationLockLeaked = true;
          return never();
        }
        return Promise.resolve();
      }),
    };
    return instance;
  };

  const instances: ReturnType<typeof makeInstance>[] = [];

  const create = (options: SqlocalOptions) => {
    const instance = makeInstance(options);
    instances.push(instance);
    if (shouldConnect) {
      // Mirror the real driver: onConnect never fires synchronously.
      queueMicrotask(() => instance.connect());
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
      mutationLockLeaked = false;
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it('retries setup, then throws when migrations still have no database', async () => {
    vi.useFakeTimers();
    sqlocalRuntime.setShouldConnect(false);
    const db = new WebDb({ enableStoragePersistence: false });

    const run = expect(db.runMigrations()).rejects.toThrow('no database');
    await vi.advanceTimersByTimeAsync(15000);
    await run;

    expect(webMigratorSpies.migrate).not.toHaveBeenCalled();
    expect(errorEvents().map(([, e]) => e.context)).toEqual([
      'setupDb: failed to set up SQLite db',
      'runMigrations: called without a database',
    ]);
  });

  it('loads the persisted database and runs migrations when the setup retry connects', async () => {
    vi.useFakeTimers();
    sharedDbSpies.getSqliteContent.mockResolvedValue(new ArrayBuffer(8));
    sqlocalRuntime.setShouldConnect(false);
    const db = new WebDb({ enableStoragePersistence: true });
    const setup = db.setupDb();
    await vi.advanceTimersByTimeAsync(15000);
    await setup;
    sqlocalRuntime.setShouldConnect(true);

    const outcome = Promise.race([
      db.runMigrations().then(() => 'done'),
      new Promise((resolve) => setTimeout(() => resolve('wedged'), 20000)),
    ]);
    await vi.advanceTimersByTimeAsync(20000);

    expect(await outcome).toBe('done');
    const retry = sqlocalRuntime.instances[1];
    expect(retry.overwriteDatabaseFile).toHaveBeenCalledTimes(1);
    expect(sharedDbSpies.setClient).toHaveBeenCalledTimes(1);
    expect(webMigratorSpies.migrate).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      retry
    );
  });

  it('destroys an abandoned instance only once it connects, leaving the retry in place', async () => {
    vi.useFakeTimers();
    sqlocalRuntime.setShouldConnect(false);
    const db = new WebDb({ enableStoragePersistence: false });
    const setup = db.setupDb();
    await vi.advanceTimersByTimeAsync(15000);
    await setup;
    const [abandoned] = sqlocalRuntime.instances;
    expect(abandoned.destroy).not.toHaveBeenCalled();
    sqlocalRuntime.setShouldConnect(true);
    await db.runMigrations();
    const retry = sqlocalRuntime.instances[1];

    abandoned.connect();
    await vi.advanceTimersByTimeAsync(0);

    expect(abandoned.destroy).toHaveBeenCalledTimes(1);
    expect(retry.destroy).not.toHaveBeenCalled();
    const fields = db as unknown as { sqlocal: unknown; client: unknown };
    expect(fields.sqlocal).toBe(retry);
    expect(fields.client).toBe(sharedDbSpies.setClient.mock.calls[0][0]);
    expect(sharedDbSpies.setClient).toHaveBeenCalledTimes(1);
  });

  it('swallows a failing destroy() of an instance that connects late', async () => {
    vi.useFakeTimers();
    sqlocalRuntime.setShouldConnect(false);
    const db = new WebDb({ enableStoragePersistence: false });
    const setup = db.setupDb();
    await vi.advanceTimersByTimeAsync(15000);
    await setup;
    const [abandoned] = sqlocalRuntime.instances;
    abandoned.destroy.mockImplementation(() =>
      Promise.reject(new Error('destroy failed'))
    );
    sqlocalRuntime.setShouldConnect(true);
    await db.runMigrations();
    const retry = sqlocalRuntime.instances[1];
    vi.useRealTimers();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      abandoned.connect();
      // Unhandled rejections are reported only after a macrotask turn.
      await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }

    expect(abandoned.destroy).toHaveBeenCalledTimes(1);
    expect(unhandled).toEqual([]);
    expect(retry.destroy).not.toHaveBeenCalled();
    const fields = db as unknown as { sqlocal: unknown; client: unknown };
    expect(fields.sqlocal).toBe(retry);
    expect(fields.client).toBe(sharedDbSpies.setClient.mock.calls[0][0]);
  });

  describe('setup failure diagnostics', () => {
    const ORIGIN = 'https://ship.example';
    const SETUP_STARTED_AT = 1000;

    const resourceEntry = (
      name: string,
      startTime: number,
      extra: Record<string, unknown> = {}
    ) => ({
      name,
      startTime,
      responseStatus: 200,
      transferSize: 856328,
      encodedBodySize: 856028,
      duration: 40,
      ...extra,
    });

    const failSetup = async (entries: () => unknown[]) => {
      vi.stubGlobal('location', { origin: ORIGIN });
      vi.spyOn(performance, 'now').mockReturnValue(SETUP_STARTED_AT);
      vi.spyOn(performance, 'getEntriesByType').mockImplementation(
        entries as () => PerformanceEntryList
      );
      sqlocalRuntime.setSqlBehavior(failingSql);
      await new WebDb({ enableStoragePersistence: false }).setupDb();
      return onlyErrorEvent();
    };

    it('reports the sqlite WASM fetched during this attempt from this origin', async () => {
      vi.stubGlobal('navigator', {
        onLine: false,
        serviceWorker: { controller: {} },
      });

      const event = await failSetup(() => [
        resourceEntry(`${ORIGIN}/apps/groups/assets/sqlite3-old1.wasm`, 900),
        resourceEntry(
          `${ORIGIN}/apps/groups/assets/sqlite3-bhtvbrz5.wasm`,
          1100,
          {
            responseStatus: 502,
            transferSize: 300,
            encodedBodySize: 0,
            duration: 12,
          }
        ),
        resourceEntry(`${ORIGIN}/apps/groups/assets/other-abc.wasm`, 1200),
        resourceEntry('https://cdn.example/assets/sqlite3-bhtvbrz5.wasm', 1300),
      ]);

      expect(event).toMatchObject({
        wasmResource: {
          file: 'sqlite3-bhtvbrz5.wasm',
          responseStatus: 502,
          transferSize: 300,
          encodedBodySize: 0,
          duration: 12,
          startedAfterSetupMs: 100,
        },
        swControlled: true,
        online: false,
      });
    });

    it('reports the latest-starting sqlite WASM when several match', async () => {
      const event = await failSetup(() => [
        resourceEntry(`${ORIGIN}/apps/groups/assets/sqlite3-first.wasm`, 1100),
        resourceEntry(`${ORIGIN}/apps/groups/assets/sqlite3-latest.wasm`, 1400),
        resourceEntry(`${ORIGIN}/apps/groups/assets/sqlite3-middle.wasm`, 1200),
      ]);

      expect(event.wasmResource).toMatchObject({
        file: 'sqlite3-latest.wasm',
        startedAfterSetupMs: 400,
      });
    });

    it('reports no WASM resource when nothing matches', async () => {
      const event = await failSetup(() => [
        resourceEntry(`${ORIGIN}/apps/groups/assets/sqlite3-old1.wasm`, 900),
        resourceEntry(`${ORIGIN}/apps/groups/assets/other-abc.wasm`, 1200),
        resourceEntry(`${ORIGIN}/apps/groups/assets/sqlite3-a.b.wasm`, 1250),
        resourceEntry('https://cdn.example/assets/sqlite3-bhtvbrz5.wasm', 1300),
      ]);

      expect(event.wasmResource).toBeNull();
    });

    it('still reports the failure when the diagnostics APIs are missing or throw', async () => {
      vi.stubGlobal('navigator', { onLine: true });

      const event = await failSetup(() => {
        throw new Error('getEntriesByType unavailable');
      });

      expect(event).toMatchObject({
        phase: 'configure',
        errorMessage: 'PRAGMA failed',
        wasmResource: null,
        online: true,
      });
      expect(event.swControlled).toBeUndefined();
    });
  });

  it('re-runs setup from migrations after a failure past connect', async () => {
    sqlocalRuntime.setSqlBehavior(failingSql);
    const db = new WebDb({ enableStoragePersistence: false });
    await db.setupDb();
    sqlocalRuntime.setSqlBehavior(async () => []);

    await db.runMigrations();

    expect(sharedDbSpies.setClient).toHaveBeenCalledTimes(1);
    expect(webMigratorSpies.migrate).toHaveBeenCalledTimes(1);
  });

  it('runs migrations once the database is set up', async () => {
    const db = new WebDb({ enableStoragePersistence: false });
    await db.setupDb();

    await db.runMigrations();

    expect(webMigratorSpies.migrate).toHaveBeenCalledTimes(1);
    expect(errorEvents()).toHaveLength(0);
  });
});
