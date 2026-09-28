import { AsyncResource } from 'node:async_hooks';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import type { PluginHookGatewayCronJob } from 'openclaw/plugin-sdk/types';
import { afterEach, expect, it, vi } from 'vitest';
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
});

it('sends the notice in the authenticated monitor scope from a gateway callback', async () => {
  const f = await setup();
  const sentAs = vi.fn();
  await runWithTlonApiScope(async () => {
    setScopedTlonApiWithPoke(vi.fn(), '~zod', 'http://zod');
    cleanups.push(
      installBudgetHoldNotifier(async () => {
        sentAs(getCurrentUserId());
        return true;
      })
    );
  });
  await f.fire('gateway_start', {}, f.ctx);
  expect(sentAs).toHaveBeenCalledWith('~zod');
  expect(f.warn).not.toHaveBeenCalled();
});

async function setup() {
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
  const on = vi.fn((name: string, handler: unknown) => {
    hooks.set(name, handler as (...args: unknown[]) => unknown);
  });
  registerBudgetHoldHooks({ on, logger: { warn } } as unknown as Pick<
    OpenClawPluginApi,
    'on' | 'logger'
  >);
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
    update,
    list,
    warn,
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
  cleanups.push(installBudgetHoldNotifier(notify));
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
    'on' | 'logger'
  >);
  expect(on).not.toHaveBeenCalled();
});

it('resumes a held task after its active run completes normally', async () => {
  const f = await setup();
  f.job.state = { runningAtMs: 50 };
  await f.fire('gateway_start', {}, f.ctx);
  f.job.state = { lastRunAtMs: 50, lastRunStatus: 'ok' };
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
  f.job.state = { lastRunAtMs: 50, lastRunStatus: 'ok' };
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
      f.job.state = { lastRunAtMs: 50, lastRunStatus: 'ok' };
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
