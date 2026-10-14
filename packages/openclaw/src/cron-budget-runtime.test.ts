import { AsyncResource } from 'node:async_hooks';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import type { PluginHookGatewayCronJob } from 'openclaw/plugin-sdk/types';
import { afterEach, expect, it, vi } from 'vitest';
import {
  readBudgetHoldState,
  emptyBudgetHoldState,
  reconcileBudgetHolds,
  writeBudgetHoldState,
} from './cron-budget-hold.js';
import { getCurrentUserId } from '@tloncorp/api';
import {
  runWithTlonApiScope,
  setScopedTlonApiWithPoke,
} from './urbit/api-client.js';
import {
  installBudgetHoldNotifier,
  registerBudgetHoldHooks,
} from './cron-budget-runtime.js';

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
  cleanups.length = 0;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it('sends the notice in the authenticated monitor scope from a gateway callback', async () => {
  const f = await setup();
  const sentAs = vi.fn();
  await runWithTlonApiScope(async () => {
    setScopedTlonApiWithPoke(vi.fn(), '~zod', 'http://zod');
    cleanups.push(
      installBudgetHoldNotifier(
        'default',
        async () => {
          sentAs(getCurrentUserId());
          return true;
        },
        f.config
      )
    );
  });
  await f.fire('gateway_start', {}, f.ctx);
  expect(sentAs).toHaveBeenCalledWith('~zod');
  expect(f.warn).not.toHaveBeenCalled();
});

async function setup(accountIds = ['default']) {
  const config = {
    channels: {
      tlon: {
        ...(accountIds.includes('default')
          ? { ship: '~zod', url: 'http://zod', code: 'test-code' }
          : {}),
        accounts: Object.fromEntries(
          accountIds
            .filter((id) => id !== 'default')
            .map((id) => [
              id,
              { ship: '~zod', url: 'http://zod', code: 'test-code' },
            ])
        ),
      },
    },
  };
  const dir = await mkdtemp(join(tmpdir(), 'cron-budget-runtime-'));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  const signal = join(dir, 'signal.json');
  vi.stubEnv('TLON_CRON_BUDGET_FILE', signal);
  vi.stubEnv('OPENCLAW_STATE_DIR', dir);
  const setBudget = (state: string) =>
    writeFile(signal, JSON.stringify({ version: 1, state }));
  await setBudget('limited');
  const hooks = new Map<string, (...args: unknown[]) => unknown>();
  const warn = vi.fn();
  const info = vi.fn();
  const on = vi.fn((name: string, handler: unknown) => {
    hooks.set(name, handler as (...args: unknown[]) => unknown);
  });
  const register = () =>
    registerBudgetHoldHooks({
      on,
      logger: { warn, info },
      config,
    } as unknown as Pick<OpenClawPluginApi, 'on' | 'logger' | 'config'>);
  register();
  const fire = async (name: string, ...args: unknown[]) =>
    hooks.get(name)?.(...args);
  cleanups.push(async () => {
    await fire('gateway_stop');
  });
  const job: PluginHookGatewayCronJob = {
    id: 'news',
    enabled: true,
    schedule: { kind: 'every', everyMs: 60_000 },
    updatedAtMs: 1,
  };
  let revision = 1;
  const update = vi.fn(async (_id: string, patch: object) => {
    Object.assign(job, patch, { updatedAtMs: ++revision });
    // Core emits a change from inside the mutation: this must not deadlock.
    await fire('cron_changed', { action: 'updated', jobId: job.id });
  });
  const list = vi.fn(async () => [structuredClone(job)]);
  const cron = { list, update };
  return {
    job,
    config,
    dir,
    register,
    update,
    list,
    warn,
    info,
    fire,
    setBudget,
    ctx: { getCron: () => cron },
  };
}

it('holds without a connected owner, then notifies once when delivery becomes available', async () => {
  const f = await setup();
  await f.fire('gateway_start', {}, f.ctx);
  expect(f.job.enabled).toBe(false);
  const notify = vi.fn(async () => true);
  cleanups.push(installBudgetHoldNotifier('default', notify, f.config));
  await f.fire('cron_changed', { action: 'added', jobId: 'another' });
  await vi.waitFor(() =>
    expect(notify).toHaveBeenCalledWith(
      'Your token credits are low. Your 1 scheduled task has been paused.',
      expect.any(String)
    )
  );
  await f.fire('gateway_start', {}, f.ctx);
  expect(f.update).toHaveBeenCalledTimes(1);
  expect(f.warn).not.toHaveBeenCalled();
});

it('observes live recovery and prevents model-forced runs while held', async () => {
  const f = await setup();
  await f.fire('gateway_start', {}, f.ctx);
  expect(
    await f.fire('before_tool_call', {
      toolName: 'cron',
      params: { action: 'run', jobId: 'news' },
    })
  ).toMatchObject({ block: true });
  expect(
    await f.fire('before_tool_call', {
      toolName: 'cron',
      params: { action: 'run', jobId: 'one-shot' },
    })
  ).toBeUndefined();
  await f.setBudget('available');
  await f.fire('cron_changed', { action: 'updated', jobId: 'another' });
  await vi.waitFor(() => expect(f.job.enabled).toBe(true));
  await f.fire('gateway_stop');
  await f.setBudget('limited');
  await f.fire('cron_changed', { action: 'updated', jobId: 'another' });
  expect(f.job.enabled).toBe(true);
  expect(f.warn).not.toHaveBeenCalled();
});

it('does not install budget policy for self-hosted instances without a signal', () => {
  vi.stubEnv('TLON_CRON_BUDGET_FILE', '');
  const on = vi.fn();
  registerBudgetHoldHooks({ on } as unknown as Pick<
    OpenClawPluginApi,
    'on' | 'logger' | 'config'
  >);
  expect(on).not.toHaveBeenCalled();
});

it('resumes a held task after its active run completes normally', async () => {
  const f = await setup();
  f.job.state = { runningAtMs: 50 };
  await f.fire('gateway_start', {}, f.ctx);
  f.job.state = { lastRunAtMs: 50, lastRunStatus: 'ok', lastDurationMs: 50 };
  f.job.updatedAtMs = 100;
  await f.setBudget('available');
  await f.fire('cron_changed', { action: 'added', jobId: 'another' });
  await vi.waitFor(() => expect(f.job.enabled).toBe(true));
  expect(f.warn).not.toHaveBeenCalled();
});

it('preserves a manual pause when completion overwrites its revision during reconciliation', async () => {
  const f = await setup();
  f.job.state = { runningAtMs: 50 };
  await f.fire('gateway_start', {}, f.ctx);
  let finishList!: (jobs: PluginHookGatewayCronJob[]) => void;
  f.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishList = resolve;
      })
  );
  await f.setBudget('available');
  await f.fire('cron_changed', { action: 'added', jobId: 'another' });
  await vi.waitFor(() => expect(finishList).toBeDefined());
  // An independent user update arrives while the budget runner awaits list.
  await f.update(f.job.id, { enabled: false });
  f.job.state = { lastRunAtMs: 50, lastRunStatus: 'ok', lastDurationMs: 50 };
  f.job.updatedAtMs = 100;
  finishList([structuredClone(f.job)]);
  await vi.waitFor(() => expect(f.job.description).toBe(''));
  await f.fire('gateway_stop');
  expect(f.job.enabled).toBe(false);
  expect(
    f.update.mock.calls.some(
      ([, patch]) => 'enabled' in patch && patch.enabled === true
    )
  ).toBe(false);
  expect(f.warn).not.toHaveBeenCalled();
});

it('does not revoke a new hold when an edit was already handled by the active pass', async () => {
  const f = await setup();
  await f.fire('gateway_start', {}, f.ctx);
  let finishList!: (jobs: PluginHookGatewayCronJob[]) => void;
  f.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishList = resolve;
      })
  );
  await f.fire('cron_changed', { action: 'added', jobId: 'another' });
  await vi.waitFor(() => expect(finishList).toBeDefined());
  await f.update(f.job.id, { enabled: true });
  finishList([structuredClone(f.job)]);
  await vi.waitFor(() => expect(f.job.enabled).toBe(false));
  await vi.waitFor(() => expect(f.list).toHaveBeenCalledTimes(5));
  // Stopping waits for the queued follow-up to finish persisting its result.
  await f.fire('gateway_stop');
  await f.setBudget('available');
  await f.fire('gateway_start', {}, f.ctx);
  expect(f.job.enabled).toBe(true);
  expect(f.warn).not.toHaveBeenCalled();
});

it('does not classify a delayed descendant callback as an owned mutation', async () => {
  const f = await setup();
  f.job.state = { runningAtMs: 50 };
  const originalUpdate = f.update.getMockImplementation()!;
  let delayedUpdate!: () => Promise<void>;
  f.update.mockImplementationOnce(async (id, patch) => {
    // Like a timer installed by core, this callback retains the async context
    // in which the original budget-owned mutation was performed.
    delayedUpdate = AsyncResource.bind(async () => {
      await f.update(f.job.id, { enabled: false });
      f.job.state = {
        lastRunAtMs: 50,
        lastRunStatus: 'ok',
        lastDurationMs: 50,
      };
      f.job.updatedAtMs = 100;
    });
    await originalUpdate(id, patch);
  });
  await f.fire('gateway_start', {}, f.ctx);
  await f.setBudget('available');
  await delayedUpdate();
  await vi.waitFor(() => expect(f.job.description).toBe(''));
  await f.fire('gateway_stop');
  expect(f.job.enabled).toBe(false);
  expect(f.warn).not.toHaveBeenCalled();
});

it('preserves edits delivered by a prewarmed plugin registry', async () => {
  const f = await setup();
  f.job.state = { runningAtMs: 50 };
  await f.fire('gateway_start', {}, f.ctx);
  f.register();
  await f.fire('gateway_start', {}, f.ctx);
  await f.setBudget('available');
  await f.update(f.job.id, { enabled: false });
  f.job.state = { lastRunAtMs: 50, lastRunStatus: 'ok', lastDurationMs: 50 };
  f.job.updatedAtMs = 100;
  await vi.waitFor(() => expect(f.job.description).toBe(''));
  await f.fire('gateway_stop');
  expect(f.job.enabled).toBe(false);
  expect(f.warn).not.toHaveBeenCalled();
});

it('recognizes owned writes through a replacement registry', async () => {
  const f = await setup();
  await f.fire('gateway_start', {}, f.ctx);
  f.register();
  await f.update(f.job.id, { enabled: true });
  await vi.waitFor(() => expect(f.job.enabled).toBe(false));
  await f.fire('gateway_stop');
  await f.setBudget('available');
  await f.fire('gateway_start', {}, f.ctx);
  expect(f.job.enabled).toBe(true);
  expect(f.warn).not.toHaveBeenCalled();
});

it('blocks a newly added recurring task before reconciliation persists its hold', async () => {
  const f = await setup();
  await f.setBudget('available');
  await f.fire('gateway_start', {}, f.ctx);
  await f.setBudget('limited');
  let finishList!: (jobs: PluginHookGatewayCronJob[]) => void;
  f.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishList = resolve;
      })
  );
  await f.fire('cron_changed', { action: 'added', jobId: f.job.id });
  await vi.waitFor(() => expect(finishList).toBeDefined());
  expect(
    (await readBudgetHoldState(join(f.dir, 'tlon-cron-budget-holds.json')))
      .holds
  ).toEqual({});
  expect(
    await f.fire('before_tool_call', {
      toolName: 'cron',
      params: { action: 'run', id: f.job.id },
    })
  ).toMatchObject({ block: true });
  // The same guard leaves one-shot reminders outside this policy.
  f.job.schedule = { kind: 'at', at: '2030-01-01T00:00:00Z' };
  expect(
    await f.fire('before_tool_call', {
      toolName: 'cron',
      params: { action: 'run', jobId: f.job.id },
    })
  ).toBeUndefined();
  finishList([structuredClone(f.job)]);
  await f.fire('gateway_stop');
  expect(f.warn).not.toHaveBeenCalled();
});

it('notifies each account in its own scope and retains successful delivery across restart', async () => {
  const f = await setup(['alice', 'bob']);
  let now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const alice = vi.fn(async () => {
    expect(getCurrentUserId()).toBe('~zod');
    return true;
  });
  const bob = vi.fn(async () => {
    expect(getCurrentUserId()).toBe('~bus');
    return false;
  });
  await runWithTlonApiScope(async () => {
    setScopedTlonApiWithPoke(vi.fn(), '~zod', 'http://zod');
    cleanups.push(installBudgetHoldNotifier('alice', alice, f.config));
  });
  let stopBob!: () => void;
  await runWithTlonApiScope(async () => {
    setScopedTlonApiWithPoke(vi.fn(), '~bus', 'http://bus');
    stopBob = installBudgetHoldNotifier('bob', bob, f.config);
    cleanups.push(stopBob);
  });
  await f.fire('gateway_start', {}, f.ctx);
  expect(alice).toHaveBeenCalledTimes(1);
  expect(bob).toHaveBeenCalledTimes(1);
  await f.fire('gateway_stop');
  await f.fire('gateway_start', {}, f.ctx);
  expect(bob).toHaveBeenCalledTimes(1);
  now += 60_000;
  bob.mockResolvedValue(true);
  await f.fire('gateway_stop');
  await f.fire('gateway_start', {}, f.ctx);
  expect(alice).toHaveBeenCalledTimes(1);
  expect(bob).toHaveBeenCalledTimes(2);
  const state = await readBudgetHoldState(
    join(f.dir, 'tlon-cron-budget-holds.json')
  );
  expect(state.notified).toBe(true);
  expect(state.notifiedRecipients?.map((key) => JSON.parse(key))).toEqual([
    ['alice', '~zod', null],
    ['bob', '~zod', null],
  ]);
  // Disconnecting the last installed monitor must not remove Alice's sender.
  stopBob();
  await f.fire('gateway_stop');
  await f.setBudget('available');
  await f.fire('gateway_start', {}, f.ctx);
  await f.fire('gateway_stop');
  await f.setBudget('limited');
  await f.fire('gateway_start', {}, f.ctx);
  expect(alice).toHaveBeenCalledTimes(2);
  expect(bob).toHaveBeenCalledTimes(2);
  expect(f.warn).not.toHaveBeenCalled();
});

it('notifies a newly runnable account after the episode was already notified', async () => {
  const f = await setup(['alice']);
  const alice = vi.fn(async () => true);
  const bob = vi.fn(async () => true);
  cleanups.push(installBudgetHoldNotifier('alice', alice, f.config));
  await f.fire('gateway_start', {}, f.ctx);
  const statePath = join(f.dir, 'tlon-cron-budget-holds.json');
  const initial = await readBudgetHoldState(statePath);
  expect(initial.notified).toBe(true);
  expect(alice).toHaveBeenCalledTimes(1);
  // A monitor reload gets a fresh config object; the gateway's original
  // configuration remains unchanged throughout this budget episode.
  const config = structuredClone(f.config);
  config.channels.tlon.accounts.bob = {
    ship: '~bus',
    url: 'http://bus',
    code: 'test-code',
  };
  cleanups.push(installBudgetHoldNotifier('bob', bob, config));
  await f.fire('cron_changed', { action: 'added', jobId: 'another' });
  await vi.waitFor(() => expect(bob).toHaveBeenCalledTimes(1));
  await f.fire('gateway_stop');
  const after = await readBudgetHoldState(statePath);
  expect(after.episodeId).toBe(initial.episodeId);
  expect(after.notified).toBe(true);
  expect(after.notifiedRecipients?.map((key) => JSON.parse(key))).toEqual([
    ['alice', '~zod', null],
    ['bob', '~bus', null],
  ]);
  expect(alice).toHaveBeenCalledTimes(1);
  expect(f.job.enabled).toBe(false);
  expect(f.warn).not.toHaveBeenCalled();
});

it('notifies a replacement owner under the same account ID and deduplicates after restart', async () => {
  const f = await setup(['alice']);
  const config = {
    ...f.config,
    channels: {
      tlon: {
        accounts: {
          alice: {
            ...f.config.channels.tlon.accounts.alice,
            ownerShip: '~bus',
          },
        },
      },
    },
  };
  const original = vi.fn(async () => true);
  const replacement = vi.fn(async () => true);
  const stopOriginal = installBudgetHoldNotifier('alice', original, config);
  cleanups.push(stopOriginal);
  await f.fire('gateway_start', {}, f.ctx);
  const path = join(f.dir, 'tlon-cron-budget-holds.json');
  const initial = await readBudgetHoldState(path);
  expect(initial.notified).toBe(true);
  const changed = structuredClone(config);
  changed.channels.tlon.accounts.alice.ownerShip = '~nec';
  cleanups.push(installBudgetHoldNotifier('alice', replacement, changed));
  stopOriginal();
  await f.fire('cron_changed', { action: 'added', jobId: 'another' });
  await vi.waitFor(() => expect(replacement).toHaveBeenCalledTimes(1));
  await f.fire('gateway_stop');
  const state = await readBudgetHoldState(path);
  expect(state.episodeId).toBe(initial.episodeId);
  expect(state.notifiedRecipients?.map((key) => JSON.parse(key))).toEqual([
    ['alice', '~zod', '~bus'],
    ['alice', '~zod', '~nec'],
  ]);
  cleanups.push(installBudgetHoldNotifier('alice', replacement, changed));
  await f.fire('gateway_start', {}, f.ctx);
  expect(original).toHaveBeenCalledTimes(1);
  expect(replacement).toHaveBeenCalledTimes(1);
  expect(f.warn).not.toHaveBeenCalled();
});

it('logs one startup snapshot, quiet steady state, and recovery to zero', async () => {
  const f = await setup();
  const events = () => f.info.mock.calls.map(([line]) => JSON.parse(line));
  await f.fire('gateway_start', {}, f.ctx);
  const first = events();
  expect(first).toHaveLength(2);
  expect(
    first.find((e) => e.event === 'TlonBot Cron Budget Snapshot')
  ).toMatchObject({
    reason: 'gateway_start',
    budgetState: 'limited',
    budgetPausedCronCount: 1,
    botShip: '~zod',
    accountId: 'default',
  });
  expect(first.find((e) => e.action === 'paused')).toMatchObject({
    jobId: 'news',
    reason: 'credit_budget',
    source: 'runtime',
  });
  await f.fire('cron_changed', { action: 'added', jobId: 'another' });
  expect(events()).toEqual(first);
  await f.setBudget('available');
  await f.fire('cron_changed', { action: 'added', jobId: 'another' });
  await vi.waitFor(() => expect(events()).toHaveLength(4));
  expect(events().find((e) => e.reason === 'state_change')).toMatchObject({
    budgetState: 'available',
    budgetPausedCronCount: 0,
  });
  expect(events().find((e) => e.action === 'resumed')).toMatchObject({
    jobId: 'news',
    episodeId: first[0].episodeId,
  });
  expect(
    (await readBudgetHoldState(join(f.dir, 'tlon-cron-budget-holds.json')))
      .pendingTelemetryChanges
  ).toBeUndefined();
});

it('replays startup pauses after preflight and emits a snapshot on every gateway start', async () => {
  const f = await setup();
  const path = join(f.dir, 'tlon-cron-budget-holds.json');
  const state = emptyBudgetHoldState();
  await reconcileBudgetHolds({
    budget: 'limited',
    state,
    cron: f.ctx.getCron(),
    save: () => writeBudgetHoldState(path, state),
    pauseOnly: true,
  });
  const eventId = state.pendingTelemetryChanges![0].eventId;
  expect(f.info).not.toHaveBeenCalled();
  await f.fire('gateway_start', {}, f.ctx);
  expect(f.info.mock.calls.map(([line]) => JSON.parse(line))).toContainEqual(
    expect.objectContaining({ eventId, action: 'paused', source: 'startup' })
  );
  await f.fire('gateway_stop');
  f.info.mockClear();
  await f.fire('gateway_start', {}, f.ctx);
  expect(f.info.mock.calls.map(([line]) => JSON.parse(line))).toEqual([
    expect.objectContaining({
      reason: 'gateway_start',
      budgetPausedCronCount: 1,
    }),
  ]);
});

it('logs an available startup with zero paused tasks', async () => {
  const f = await setup();
  await f.setBudget('available');
  await f.fire('gateway_start', {}, f.ctx);
  expect(f.info.mock.calls.map(([line]) => JSON.parse(line))).toEqual([
    expect.objectContaining({
      budgetState: 'available',
      budgetPausedCronCount: 0,
      reason: 'gateway_start',
    }),
  ]);
});

it('excludes failed pause intents from the snapshot count', async () => {
  const f = await setup();
  f.update.mockRejectedValueOnce(new Error('update failed'));
  await f.fire('gateway_start', {}, f.ctx);
  expect(f.info.mock.calls.map(([line]) => JSON.parse(line))).toEqual([
    expect.objectContaining({
      budgetState: 'limited',
      budgetPausedCronCount: 0,
    }),
  ]);
  expect(f.warn).toHaveBeenCalled();
});

it.each(['added', 'updated'] as const)(
  'pauses an %s task while owner delivery remains pending',
  async (action) => {
    const f = await setup();
    let finishNotice!: (delivered: boolean) => void;
    const notify = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishNotice = resolve;
        })
    );
    cleanups.push(installBudgetHoldNotifier('default', notify, f.config));
    try {
      // This must complete while notification delivery is still unresolved.
      await f.fire('gateway_start', {}, f.ctx);
      expect(f.job.enabled).toBe(false);
      expect(notify).toHaveBeenCalledOnce();
      if (action === 'added') {
        f.job.id = 'new-task';
        f.job.enabled = true;
        f.job.updatedAtMs = 10;
        await f.fire('cron_changed', { action, jobId: f.job.id });
      } else {
        await f.update(f.job.id, { enabled: true });
      }
      await vi.waitFor(() => expect(f.job.enabled).toBe(false));
      // A late receipt must not restore the ledger from before the new hold.
      finishNotice(true);
      const path = join(f.dir, 'tlon-cron-budget-holds.json');
      await vi.waitFor(async () => {
        const state = await readBudgetHoldState(path);
        expect(state.notified).toBe(true);
        expect(state.holds[f.job.id]?.revision).toBe(f.job.updatedAtMs);
      });
      expect(notify).toHaveBeenCalledOnce();
      expect(f.warn).not.toHaveBeenCalled();
    } finally {
      finishNotice?.(false);
    }
  }
);

it('recovers during a pending notice and ignores its receipt in a later episode', async () => {
  const f = await setup();
  let finishNotice!: (delivered: boolean) => void;
  const notify = vi
    .fn(async () => false)
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishNotice = resolve;
        })
    );
  cleanups.push(installBudgetHoldNotifier('default', notify, f.config));
  try {
    await f.fire('gateway_start', {}, f.ctx);
    const path = join(f.dir, 'tlon-cron-budget-holds.json');
    const initial = await readBudgetHoldState(path);
    await f.setBudget('available');
    await f.fire('cron_changed', { action: 'added', jobId: 'another' });
    await vi.waitFor(() => expect(f.job.enabled).toBe(true));
    await f.setBudget('limited');
    await f.fire('cron_changed', { action: 'added', jobId: 'another' });
    await vi.waitFor(() => expect(f.job.enabled).toBe(false));
    finishNotice(true);
    await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(2));
    await f.fire('gateway_stop');
    const current = await readBudgetHoldState(path);
    expect(current.episodeId).not.toBe(initial.episodeId);
    expect(current.notified).toBe(false);
    expect(current.notifiedRecipients ?? []).toEqual([]);
  } finally {
    finishNotice?.(false);
  }
});

it('keeps startup holds until the wrapper replaces a stale available signal', async () => {
  const f = await setup();
  await f.setBudget('available');
  vi.stubEnv(
    'TLON_CRON_BUDGET_STARTUP',
    JSON.stringify({ state: 'limited', staleRevision: null })
  );
  await f.fire('gateway_start', {}, f.ctx);
  expect(f.job.enabled).toBe(false);
  await f.fire('cron_changed', { action: 'added', jobId: 'another' });
  await f.fire('gateway_stop');
  expect(f.job.enabled).toBe(false);
  await writeFile(
    join(f.dir, 'signal.json'),
    JSON.stringify({
      version: 1,
      state: 'available',
      revision: 'fresh-publication',
    })
  );
  await f.fire('gateway_start', {}, f.ctx);
  expect(f.job.enabled).toBe(true);
});
