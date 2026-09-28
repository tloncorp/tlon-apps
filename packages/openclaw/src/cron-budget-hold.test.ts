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
  reconcileBudgetHolds,
  writeBudgetHoldState,
  type BudgetState,
} from './cron-budget-hold.js';

function fixture() {
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
  const notify = vi.fn(async (_message: string) => true);
  const update = vi.fn(
    async (id: string, patch: { enabled?: boolean; description?: string }) => {
      const job = jobs.find((j) => j.id === id)!;
      Object.assign(job, patch, { updatedAtMs: ++revision });
      if (job.description !== undefined)
        job.description = job.description.trim();
    }
  );
  const cron = { list: async () => structuredClone(jobs), update };
  const reconcile = (budget: BudgetState, pauseOnly = false) =>
    reconcileBudgetHolds({ budget, state, cron, save, notify, pauseOnly });
  return { jobs, state, save, notify, update, cron, reconcile };
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
    expect(f.notify).toHaveBeenCalledExactlyOnceWith(
      'Your token credits are low. Your 2 scheduled tasks have been paused.'
    );
    await f.reconcile('limited');
    expect(f.notify).toHaveBeenCalledTimes(1);
    expect(f.update).toHaveBeenCalledTimes(2);
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

  it('does not label or notify when no enabled recurring tasks exist', async () => {
    const f = fixture();
    f.jobs.splice(0, 2);
    await f.reconcile('limited');
    expect(f.notify).not.toHaveBeenCalled();
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
