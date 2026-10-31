import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PluginHookGatewayCronJob } from 'openclaw/plugin-sdk/types';
import {
  BUDGET_HOLD_PREFIX,
  emptyBudgetHoldState,
  readBudgetHoldState,
  readBudgetSignal,
  readBudgetSignalDetails,
  reconcileBudgetHolds,
  stripSystemOwnedHoldLabels,
  writeBudgetHoldState,
  type BudgetState,
} from './cron-budget-hold.js';
import { reconcileCreditNotice } from './credit-notice.js';

const limitedNotice = (tasks: number) =>
  `You've used almost all of this month's included credits, so I've switched to a free model and paused your ${tasks} scheduled tasks until they reset.`;

function fixture() {
  let now = 1_000_000;
  let revision = 100;
  const jobs: PluginHookGatewayCronJob[] = [
    {
      id: 'report',
      enabled: true,
      description: 'Morning news',
      updatedAtMs: 1,
      schedule: { kind: 'cron', expr: '0 9 * * *' },
    },
    {
      id: 'watch',
      enabled: true,
      updatedAtMs: 1,
      schedule: { kind: 'every', everyMs: 60_000 },
    },
    {
      id: 'manual',
      enabled: false,
      updatedAtMs: 1,
      schedule: { kind: 'every', everyMs: 60_000 },
    },
    {
      id: 'reminder',
      enabled: true,
      updatedAtMs: 1,
      schedule: { kind: 'at', at: '2030-01-01T00:00:00Z' },
    },
  ];
  const state = emptyBudgetHoldState();
  const save = vi.fn(async () => {});
  const notify = vi.fn(
    async (_message: string, _offerIncrease: boolean) => true
  );
  const update = vi.fn(
    async (id: string, patch: { enabled?: boolean; description?: string }) => {
      const job = jobs.find((j) => j.id === id)!;
      Object.assign(job, patch, { updatedAtMs: ++revision });
      if (job.description !== undefined)
        job.description = job.description.trim();
    }
  );
  const cron = { list: async () => structuredClone(jobs), update };
  // The runner's order: the notice counts the holds of a clean pass. The
  // pre-gateway bootstrap sends none.
  const reconcile = async (budget: BudgetState, pauseOnly = false) => {
    await reconcileBudgetHolds({
      budget,
      state,
      cron,
      save,
      pauseOnly,
      now: () => now,
    });
    if (!pauseOnly) {
      await reconcileCreditNotice({
        budget,
        credit: null,
        state,
        save,
        notify,
        now: () => now,
      });
    }
  };
  return {
    jobs,
    state,
    save,
    notify,
    update,
    cron,
    reconcile,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('cron budget holds', () => {
  it('retains hold ownership when core records an interrupted startup run', async () => {
    const f = fixture();
    f.jobs[0].state = { runningAtMs: 50 };
    await f.reconcile('limited', true);
    // Core startup bookkeeping changes updatedAtMs without a user edit.
    f.jobs[0].updatedAtMs = 200;
    f.jobs[0].state = {
      lastRunAtMs: 50,
      lastRunStatus: 'error',
      lastDurationMs: 150,
    };
    await f.reconcile('limited');
    expect(f.state.holds.report.revision).toBe(200);
    await f.reconcile('available');
    expect(f.jobs[0].enabled).toBe(true);
  });
  it.each(['ok', 'error'] as const)(
    'retains ownership when an already-running task finishes with %s',
    async (lastRunStatus) => {
      const f = fixture();
      f.jobs[0].state = { runningAtMs: 50 };
      await f.reconcile('limited');
      f.jobs[0].updatedAtMs = 200;
      f.jobs[0].state = { lastRunAtMs: 50, lastRunStatus, lastDurationMs: 150 };
      await f.reconcile('limited');
      await f.reconcile('available');
      expect(f.jobs[0].enabled).toBe(true);
    }
  );

  it.each(['limited', 'available'] as const)(
    'does not adopt a post-completion edit after restart with %s credit',
    async (budget) => {
      const f = fixture();
      f.jobs[0].state = { runningAtMs: 50 };
      await f.reconcile('limited');
      f.jobs[0].state = {
        lastRunAtMs: 50,
        lastRunStatus: 'ok',
        lastDurationMs: 150,
      };
      // Completion was revision 200; an offline operator edit came afterward.
      f.jobs[0].updatedAtMs = 201;
      const restored = JSON.parse(JSON.stringify(f.state));
      await reconcileBudgetHolds({
        budget,
        state: restored,
        cron: f.cron,
        save: f.save,
      });
      expect(f.jobs[0].enabled).toBe(false);
      expect(restored.holds.report).toBeUndefined();
    }
  );

  it('retains ownership after core trims the label of a task without a description', async () => {
    const f = fixture();
    await f.reconcile('limited');
    expect(f.jobs[1].description).toBe(BUDGET_HOLD_PREFIX.trimEnd());
    await f.reconcile('limited');
    expect(f.state.holds.watch).toBeDefined();
    await f.reconcile('available');
    expect(f.jobs[1].enabled).toBe(true);
    expect(f.jobs[1].description).toBe('');
  });

  it('holds recurring jobs, preserving manual disables and one-shot reminders', async () => {
    const f = fixture();
    await f.reconcile('limited');
    expect(f.jobs.map((j) => j.enabled)).toEqual([false, false, false, true]);
    expect(f.jobs[0].description).toBe(BUDGET_HOLD_PREFIX + 'Morning news');
    expect(Object.keys(f.state.holds)).toEqual(['report', 'watch']);
    expect(f.notify).toHaveBeenCalledExactlyOnceWith(limitedNotice(2), true);
    await f.reconcile('limited');
    expect(f.notify).toHaveBeenCalledTimes(1);
    expect(f.update).toHaveBeenCalledTimes(2);
  });

  it('holds a stream job while limited and releases it on recovery', async () => {
    const f = fixture();
    f.jobs.push({
      id: 'tail',
      enabled: true,
      description: 'Watch the log',
      updatedAtMs: 1,
      schedule: { kind: 'stream', command: ['tail', '-f', 'app.log'] },
    });
    await f.reconcile('limited');
    const tail = () => f.jobs.find((j) => j.id === 'tail')!;
    expect(tail().enabled).toBe(false);
    expect(tail().description).toBe(BUDGET_HOLD_PREFIX + 'Watch the log');
    expect(f.state.holds.tail).toBeDefined();
    await f.reconcile('available');
    expect(tail().enabled).toBe(true);
    expect(tail().description).toBe('Watch the log');
    expect(f.state.holds).toEqual({});
  });

  it('does not release holds on unknown credit and resumes only its own disables', async () => {
    const f = fixture();
    const schedules = f.jobs.map((j) => structuredClone(j.schedule));
    await f.reconcile('limited');
    await f.reconcile('unknown');
    expect(f.jobs[0].enabled).toBe(false);
    // Explicitly disabling an already-held job is a manual pause.
    await f.update('watch', { enabled: false });
    await f.reconcile('available');
    expect(f.jobs.map((j) => j.enabled)).toEqual([true, false, false, true]);
    expect(f.jobs[0].description).toBe('Morning news');
    expect(f.jobs[1].description).toBe('');
    expect(f.jobs.map((j) => j.schedule)).toEqual(schedules);
    expect(f.state.holds).toEqual({});
  });

  it('re-holds a task explicitly enabled during a budget hold and holds new jobs', async () => {
    const f = fixture();
    await f.reconcile('limited');
    await f.update('report', { enabled: true });
    f.jobs.push({
      id: 'new',
      enabled: true,
      schedule: { kind: 'every', everyMs: 1_000 },
    });
    await f.reconcile('limited');
    expect(f.jobs.find((j) => j.id === 'new')?.enabled).toBe(false);
    expect(f.jobs[0].enabled).toBe(false);
    expect(f.jobs[0].description).toBe(BUDGET_HOLD_PREFIX + 'Morning news');
    expect(f.notify).toHaveBeenCalledTimes(1);
  });

  it('retries a failed notice and sends a new notice in the next budget episode', async () => {
    const f = fixture();
    f.notify.mockResolvedValueOnce(false);
    await f.reconcile('limited');
    expect(f.state.notified).toBe(false);
    await f.reconcile('limited');
    expect(f.notify).toHaveBeenCalledTimes(1);
    f.advance(60_000);
    await f.reconcile('limited');
    expect(f.state.notified).toBe(true);
    await f.reconcile('available');
    await f.reconcile('limited');
    expect(f.notify).toHaveBeenCalledTimes(3);
  });

  it('leaves release to the live service at bootstrap, and handles removed jobs', async () => {
    const f = fixture();
    await f.reconcile('limited');
    f.jobs.splice(1, 1);
    await f.reconcile('available', true);
    expect(f.jobs[0].enabled).toBe(false);
    await f.reconcile('available');
    expect(f.jobs[0].enabled).toBe(true);
    expect(f.state.holds).toEqual({});
  });

  it('recovers a crash after disabling but before recording the revision', async () => {
    const f = fixture();
    f.save.mockImplementation(async () => {
      if (f.jobs[0].enabled === false) throw new Error('disk failure');
    });
    await expect(f.reconcile('limited')).rejects.toThrow('disk failure');
    // The durable write-ahead intent has no revision yet.
    const recovered = emptyBudgetHoldState();
    recovered.limited = true;
    recovered.holds.report = { description: 'Morning news' };
    await reconcileBudgetHolds({
      budget: 'available',
      state: recovered,
      cron: f.cron,
      save: async () => {},
    });
    expect(f.jobs[0].enabled).toBe(true);
  });

  it('labels nothing but still tells the owner when no enabled recurring tasks exist', async () => {
    const f = fixture();
    f.jobs.splice(0, 2);
    await f.reconcile('limited');
    expect(f.update).not.toHaveBeenCalled();
    expect(f.notify).toHaveBeenCalledExactlyOnceWith(
      "You've used almost all of this month's included credits, so I've switched to a free model until they reset.",
      true
    );
  });

  it('never edits system-owned monitor jobs and still holds later user jobs', async () => {
    const f = fixture();
    const monitors: PluginHookGatewayCronJob[] = [
      {
        id: 'skill-review',
        declarationKey: 'skill-collection-review:main',
        enabled: true,
        updatedAtMs: 1,
        schedule: { kind: 'every', everyMs: 604_800_000 },
        payload: { kind: 'agentTurn' },
      },
      {
        id: 'heartbeat',
        declarationKey: 'heartbeat:main',
        enabled: true,
        updatedAtMs: 1,
        schedule: { kind: 'every', everyMs: 1_800_000 },
        payload: { kind: 'agentTurn' },
      },
      {
        id: 'heartbeat-payload',
        enabled: true,
        updatedAtMs: 1,
        schedule: { kind: 'every', everyMs: 1_800_000 },
        payload: { kind: 'heartbeat' },
      },
    ];
    f.jobs.unshift(...monitors);
    f.jobs.push({
      id: 'imported-task',
      declarationKey: 'heartbeat-task:check-mail',
      enabled: true,
      updatedAtMs: 1,
      schedule: { kind: 'every', everyMs: 60_000 },
    });
    await f.reconcile('limited');
    const touched = () => f.update.mock.calls.map(([id]) => id);
    expect(touched()).toEqual(['report', 'watch', 'imported-task']);
    expect(f.jobs.slice(0, 3).map((j) => j.enabled)).toEqual([
      true,
      true,
      true,
    ]);
    expect(Object.keys(f.state.holds)).toEqual([
      'report',
      'watch',
      'imported-task',
    ]);
    expect(f.notify).toHaveBeenCalledExactlyOnceWith(limitedNotice(3), true);
    await f.reconcile('available');
    expect(touched()).not.toContain('skill-review');
    expect(touched()).not.toContain('heartbeat');
    expect(touched()).not.toContain('heartbeat-payload');
    expect(f.jobs.find((j) => j.id === 'report')?.enabled).toBe(true);
    expect(f.jobs.find((j) => j.id === 'imported-task')?.enabled).toBe(true);
    expect(f.state.holds).toEqual({});
  });

  it('drops a stale hold on a system-owned job without editing it', async () => {
    const f = fixture();
    f.jobs.unshift({
      id: 'skill-review',
      declarationKey: 'skill-collection-review:main',
      enabled: true,
      updatedAtMs: 1,
      schedule: { kind: 'every', everyMs: 604_800_000 },
      payload: { kind: 'agentTurn' },
      description: BUDGET_HOLD_PREFIX + 'Review skills',
    });
    f.state.limited = true;
    f.state.episodeId = 'episode';
    f.state.holds['skill-review'] = { description: 'Review skills' };
    await f.reconcile('limited');
    expect(f.state.holds['skill-review']).toBeUndefined();
    expect(f.update.mock.calls.map(([id]) => id)).toEqual(['report', 'watch']);
  });

  it('strips stale budget labels from system-owned jobs only', () => {
    const system = { declarationKey: 'skill-collection-review:main' };
    const stripped = stripSystemOwnedHoldLabels([
      { id: 'spaced', ...system, description: BUDGET_HOLD_PREFIX + 'Review' },
      { id: 'bare', ...system, description: BUDGET_HOLD_PREFIX.trimEnd() },
      {
        id: 'payload',
        payload: { kind: 'heartbeat' },
        description: BUDGET_HOLD_PREFIX + 'Beat',
      },
      { id: 'unlabelled', ...system, description: 'Review' },
      { id: 'undescribed', ...system },
      { id: 'user', description: BUDGET_HOLD_PREFIX + 'Mine' },
    ]);
    expect(stripped).toEqual([
      { id: 'spaced', ...system, description: 'Review' },
      { id: 'bare', ...system },
      { id: 'payload', payload: { kind: 'heartbeat' }, description: 'Beat' },
    ]);
  });

  it('keeps holding other jobs when one update fails and notifies once clean', async () => {
    const f = fixture();
    f.update.mockRejectedValueOnce(new Error('update rejected'));
    await expect(f.reconcile('limited')).rejects.toThrow('update rejected');
    expect(f.jobs[0].enabled).toBe(true);
    expect(f.jobs[1].enabled).toBe(false);
    expect(f.state.holds.watch.revision).toBeDefined();
    expect(f.notify).not.toHaveBeenCalled();
    await f.reconcile('limited');
    expect(f.jobs[0].enabled).toBe(false);
    expect(f.state.holds.report.revision).toBeDefined();
    expect(f.notify).toHaveBeenCalledExactlyOnceWith(limitedNotice(2), true);
  });
});

const temporaryDirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirs.splice(0).map((d) => rm(d, { recursive: true, force: true }))
  );
});

it('persists ownership and notice deduplication across process restarts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'budget-hold-'));
  temporaryDirs.push(dir);
  const path = join(dir, 'state.json');
  const f = fixture();
  await f.reconcile('limited');
  await writeBudgetHoldState(path, f.state);
  const restored = await readBudgetHoldState(path);
  await reconcileBudgetHolds({
    budget: 'limited',
    state: restored,
    cron: f.cron,
    save: async () => {},
  });
  await reconcileCreditNotice({
    budget: 'limited',
    credit: null,
    state: restored,
    save: async () => {},
    notify: f.notify,
  });
  expect(f.notify).toHaveBeenCalledTimes(1);
  await writeFile(path, '{}');
  await expect(readBudgetHoldState(path)).rejects.toThrow(
    'Invalid cron budget hold state'
  );
});

it('treats missing, malformed, or unknown signals as unknown', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'budget-signal-'));
  temporaryDirs.push(dir);
  const path = join(dir, 'signal.json');
  expect(await readBudgetSignal(path)).toBe('unknown');
  for (const content of ['nope', '{}', '{"version":1,"state":"unknown"}']) {
    await writeFile(path, content);
    expect(await readBudgetSignal(path)).toBe('unknown');
  }
  await writeFile(path, '{"version":1,"state":"limited"}');
  expect(await readBudgetSignal(path)).toBe('limited');
});

it('reads the credit hosting publishes, and ignores one it cannot use', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'budget-credit-'));
  temporaryDirs.push(dir);
  const path = join(dir, 'signal.json');
  const credit = { keyOwner: 'owner', remainingUsd: 3, limitUsd: null };
  await writeFile(
    path,
    JSON.stringify({ version: 1, state: 'available', credit })
  );
  expect(await readBudgetSignalDetails(path)).toEqual({
    state: 'available',
    credit,
  });
  for (const bad of [
    { ...credit, keyOwner: 'tlonbot' },
    { ...credit, limitUsd: '5' },
  ]) {
    await writeFile(
      path,
      JSON.stringify({ version: 1, state: 'available', credit: bad })
    );
    expect((await readBudgetSignalDetails(path)).credit).toBeNull();
  }
});

it('backs off failed notices exponentially without delaying new holds or recovery', async () => {
  const f = fixture();
  f.notify.mockResolvedValue(false);
  for (const delay of [60_000, 120_000, 240_000, 480_000, 900_000, 900_000]) {
    const calls = f.notify.mock.calls.length;
    await f.reconcile('limited');
    expect(f.notify).toHaveBeenCalledTimes(calls + 1);
    f.advance(delay - 1);
    await f.reconcile('limited');
    expect(f.notify).toHaveBeenCalledTimes(calls + 1);
    f.advance(1);
  }
  f.jobs[2].enabled = true;
  await f.reconcile('limited');
  expect(f.jobs[2].enabled).toBe(false);
  await f.reconcile('available');
  expect(f.jobs[0].enabled).toBe(true);
  expect(f.state.nextNotificationAtMs).toBeUndefined();
  f.notify.mockResolvedValue(true);
  await f.reconcile('limited');
  expect(f.state.notified).toBe(true);
});

it('persists the retry deadline before a throwing delivery and honors it after reload', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cron-budget-backoff-'));
  try {
    const path = join(dir, 'holds.json');
    const f = fixture();
    f.save.mockImplementation(() => writeBudgetHoldState(path, f.state));
    f.notify.mockImplementation(async () => {
      throw new Error('network unavailable');
    });
    await expect(f.reconcile('limited')).rejects.toThrow('network unavailable');
    const state = await readBudgetHoldState(path);
    expect(state.notificationAttempts).toBe(1);
    expect(state.nextNotificationAtMs).toBe(1_060_000);
    await reconcileCreditNotice({
      budget: 'limited',
      credit: null,
      state,
      save: async () => {},
      notify: f.notify,
      now: () => 1_030_000,
    });
    expect(f.notify).toHaveBeenCalledTimes(1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('budget transition journal', () => {
  it('journals confirmed pauses once across startup and recovery in the same episode', async () => {
    const f = fixture();
    await f.reconcile('limited', true);
    const paused = structuredClone(f.state.pendingTelemetryChanges!);
    expect(paused).toHaveLength(2);
    expect(paused.map(({ jobId }) => jobId)).toEqual(['report', 'watch']);
    expect(paused[0]).toMatchObject({
      action: 'paused',
      source: 'startup',
      reason: 'credit_budget',
      occurredAtMs: 1_000_000,
      episodeId: f.state.episodeId,
    });
    await f.reconcile('limited');
    expect(f.state.pendingTelemetryChanges).toEqual(paused);
    f.advance(100);
    await f.reconcile('available');
    expect(f.state.pendingTelemetryChanges).toHaveLength(4);
    expect(f.state.pendingTelemetryChanges!.slice(2)).toEqual(
      paused.map((event) => ({
        ...event,
        eventId: expect.any(String),
        occurredAtMs: 1_000_100,
        action: 'resumed',
        reason: 'credit_recovered',
        source: 'runtime',
      }))
    );
    expect(
      new Set(f.state.pendingTelemetryChanges!.map((e) => e.eventId)).size
    ).toBe(4);
    expect(f.state.holds).toEqual({});
  });

  it('does not report failed mutations or manual ownership changes as budget transitions', async () => {
    const f = fixture();
    const changes = () =>
      f.state.pendingTelemetryChanges?.map((e) => [e.jobId, e.action]);
    f.update.mockRejectedValueOnce(new Error('mutation failed'));
    await expect(f.reconcile('limited')).rejects.toThrow('mutation failed');
    expect(changes()).toEqual([['watch', 'paused']]);
    await f.reconcile('limited');
    expect(changes()).toEqual([
      ['watch', 'paused'],
      ['report', 'paused'],
    ]);
    delete f.state.pendingTelemetryChanges;
    f.update.mockRejectedValueOnce(new Error('resume failed'));
    await expect(f.reconcile('available')).rejects.toThrow('resume failed');
    expect(changes()).toEqual([['watch', 'resumed']]);
    delete f.state.pendingTelemetryChanges;
    f.jobs[0].updatedAtMs = 999; // manual edit while held
    await f.reconcile('available');
    expect(f.state.pendingTelemetryChanges).toBeUndefined();
  });

  it('recovers a confirmed pause from a persisted write-ahead intent once', async () => {
    const f = fixture();
    f.jobs[0].enabled = false;
    f.jobs[0].description = BUDGET_HOLD_PREFIX + 'Morning news';
    f.state.holds.report = { description: 'Morning news' };
    await f.reconcile('limited');
    expect(
      f.state.pendingTelemetryChanges?.filter((e) => e.jobId === 'report')
    ).toHaveLength(1);
    await f.reconcile('limited');
    expect(
      f.state.pendingTelemetryChanges?.filter((e) => e.jobId === 'report')
    ).toHaveLength(1);
  });
});

it('does not let telemetry persistence gate recovery of an incomplete pause intent', async () => {
  const f = fixture();
  f.state.limited = true;
  f.state.episodeId = 'episode';
  f.state.holds.report = { description: 'Morning news' };
  f.jobs[0].enabled = false;
  f.jobs[0].description = BUDGET_HOLD_PREFIX + 'Morning news';
  f.save.mockRejectedValue(new Error('ledger unavailable'));
  await expect(f.reconcile('available')).rejects.toThrow('ledger unavailable');
  expect(f.jobs[0].enabled).toBe(true);
  expect(f.state.pendingTelemetryChanges?.map((e) => e.action)).toEqual([
    'paused',
    'resumed',
  ]);
});

it.each(['limited', 'unknown'] as const)(
  'uses unpublished %s startup state until a new signal revision arrives',
  async (state) => {
    const dir = await mkdtemp(join(tmpdir(), 'budget-startup-'));
    temporaryDirs.push(dir);
    const path = join(dir, 'signal.json');
    vi.stubEnv(
      'TLON_CRON_BUDGET_STARTUP',
      JSON.stringify({ state, staleRevision: 'old' })
    );
    try {
      expect(await readBudgetSignal(path)).toBe(state);
      for (const revision of [undefined, 'old']) {
        await writeFile(
          path,
          JSON.stringify({ version: 1, state: 'available', revision })
        );
        expect(await readBudgetSignal(path)).toBe(state);
      }
      await writeFile(
        path,
        JSON.stringify({ version: 1, state: 'available', revision: 'new' })
      );
      expect(await readBudgetSignal(path)).toBe('available');
      await rm(path);
      expect(await readBudgetSignal(path)).toBe('unknown');
      await writeFile(path, 'malformed');
      expect(await readBudgetSignal(path)).toBe('unknown');
    } finally {
      vi.unstubAllEnvs();
    }
  }
);
