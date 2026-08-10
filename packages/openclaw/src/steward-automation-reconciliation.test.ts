import type {
  PluginHookCronChangedEvent,
  PluginHookGatewayContext,
  PluginHookGatewayCronJob,
} from 'openclaw/plugin-sdk/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { submitStewardAutomationProject } from './steward-automation-adapter.js';
import {
  StewardAutomationCronUnavailableError,
  StewardAutomationReconciler,
  reconcileStewardAutomation,
  registerStewardAutomationReconciliationHooks,
} from './steward-automation-reconciliation.js';

vi.mock('./steward-automation-adapter.js', () => ({
  submitStewardAutomationProject: vi.fn(),
}));

type HookHandler = (event: unknown, context: unknown) => unknown;

function createFakeHookApi() {
  const handlers = new Map<string, HookHandler[]>();
  return {
    on: vi.fn((name: string, handler: HookHandler) => {
      handlers.set(name, [...(handlers.get(name) ?? []), handler]);
    }),
    fire: async (name: string, event: unknown, context: unknown) => {
      for (const handler of handlers.get(name) ?? []) {
        await handler(event, context);
      }
    },
  };
}

function cronContext(jobs: PluginHookGatewayCronJob[]) {
  const list = vi.fn().mockResolvedValue(jobs);
  const context: Pick<PluginHookGatewayContext, 'getCron'> = {
    getCron: () => ({ list }),
  };
  return { context, list };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function job(id: string): PluginHookGatewayCronJob {
  return {
    id,
    enabled: true,
    payload: { kind: 'agentTurn', text: id },
  };
}

const jobs = [
  {
    id: 'disabled-job',
    agentId: 'main',
    name: 'Nightly status',
    enabled: false,
    schedule: { kind: 'cron', expr: '0 1 * * *', tz: 'UTC' },
    payload: { kind: 'agentTurn', text: 'check status' },
    state: { lastRunStatus: 'ok', lastRunAtMs: 1_777_000_000_000 },
    createdAtMs: 1_700_000_000_000,
  },
] satisfies PluginHookGatewayCronJob[];

beforeEach(() => {
  vi.mocked(submitStewardAutomationProject).mockReset();
  vi.mocked(submitStewardAutomationProject).mockResolvedValue(undefined);
});

describe('reconcileStewardAutomation', () => {
  it('reads the complete list including disabled jobs and submits its normalized project', async () => {
    const { context, list } = cronContext(jobs);

    await reconcileStewardAutomation(context.getCron);

    expect(list).toHaveBeenCalledOnce();
    expect(list).toHaveBeenCalledWith({ includeDisabled: true });
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).toHaveBeenCalledWith({
      project: {
        tasks: [
          {
            id: 'disabled-job',
            agentId: 'main',
            name: 'Nightly status',
            enabled: false,
            schedule: { kind: 'cron', expr: '0 1 * * *', tz: 'UTC' },
            payload: { kind: 'agentTurn', text: 'check status' },
            createdAtMs: 1_700_000_000_000,
          },
        ],
      },
    });
  });

  it('submits an empty complete project after a successful empty read', async () => {
    const { context } = cronContext([]);

    await reconcileStewardAutomation(context.getCron);

    expect(submitStewardAutomationProject).toHaveBeenCalledWith({
      project: { tasks: [] },
    });
  });

  it.each([
    ['missing getCron', undefined],
    ['unready cron service', () => undefined],
  ])('fails clearly for %s without submitting', async (_label, getCron) => {
    await expect(reconcileStewardAutomation(getCron)).rejects.toMatchObject({
      name: 'StewardAutomationCronUnavailableError',
      retryable: true,
    });
    await expect(reconcileStewardAutomation(getCron)).rejects.toBeInstanceOf(
      StewardAutomationCronUnavailableError
    );
    expect(submitStewardAutomationProject).not.toHaveBeenCalled();
  });

  it('propagates read failures without submitting an empty project', async () => {
    const readError = new Error('cron list unavailable');
    const list = vi.fn().mockRejectedValue(readError);

    await expect(reconcileStewardAutomation(() => ({ list }))).rejects.toBe(
      readError
    );
    expect(submitStewardAutomationProject).not.toHaveBeenCalled();
  });

  it('propagates submission failures for later retry', async () => {
    const submissionError = new Error('poke nack');
    const { context } = cronContext(jobs);
    vi.mocked(submitStewardAutomationProject).mockRejectedValue(
      submissionError
    );

    await expect(reconcileStewardAutomation(context.getCron)).rejects.toBe(
      submissionError
    );
  });
});

describe('StewardAutomationReconciler', () => {
  it('serializes lists and coalesces a busy burst using the latest accessor', async () => {
    const firstList = deferred<PluginHookGatewayCronJob[]>();
    const list1 = vi.fn(() => firstList.promise);
    const list2 = vi.fn().mockResolvedValue([job('stale-follow-up')]);
    const list3 = vi.fn().mockResolvedValue([job('latest-follow-up')]);
    const reconciler = new StewardAutomationReconciler();

    const first = reconciler.trigger(() => ({ list: list1 }));
    const stale = Array.from({ length: 8 }, () =>
      reconciler.trigger(() => ({ list: list2 }))
    );
    const latest = reconciler.trigger(() => ({ list: list3 }));

    expect(list1).toHaveBeenCalledOnce();
    expect(list2).not.toHaveBeenCalled();
    expect(list3).not.toHaveBeenCalled();

    firstList.resolve([job('first')]);
    await first;
    await Promise.all([...stale, latest]);

    expect(list1).toHaveBeenCalledOnce();
    expect(list2).not.toHaveBeenCalled();
    expect(list3).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).toHaveBeenCalledTimes(2);
    expect(submitStewardAutomationProject).toHaveBeenNthCalledWith(1, {
      project: { tasks: [expect.objectContaining({ id: 'first' })] },
    });
    expect(submitStewardAutomationProject).toHaveBeenNthCalledWith(2, {
      project: {
        tasks: [expect.objectContaining({ id: 'latest-follow-up' })],
      },
    });
  });

  it('waits for submission before starting a triggered follow-up', async () => {
    const firstAcknowledgement = deferred<unknown>();
    vi.mocked(submitStewardAutomationProject)
      .mockImplementationOnce(() => firstAcknowledgement.promise.then(() => {}))
      .mockResolvedValueOnce(undefined);
    const firstContext = cronContext([job('older')]);
    const nextContext = cronContext([job('newer')]);
    const reconciler = new StewardAutomationReconciler();

    const first = reconciler.trigger(firstContext.context.getCron);
    await vi.waitFor(() => {
      expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    });
    const next = reconciler.trigger(nextContext.context.getCron);

    expect(nextContext.list).not.toHaveBeenCalled();
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();

    firstAcknowledgement.resolve(undefined);
    await first;
    await next;

    expect(nextContext.list).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).toHaveBeenCalledTimes(2);
    expect(submitStewardAutomationProject).toHaveBeenNthCalledWith(1, {
      project: { tasks: [expect.objectContaining({ id: 'older' })] },
    });
    expect(submitStewardAutomationProject).toHaveBeenNthCalledWith(2, {
      project: { tasks: [expect.objectContaining({ id: 'newer' })] },
    });
  });

  it('starts a new worker for a trigger arriving at worker settlement', async () => {
    const secondRun = deferred<void>();
    const reconcile = vi
      .fn<() => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => secondRun.promise);
    const reconciler = new StewardAutomationReconciler(reconcile);
    let secondSettled = false;

    const first = reconciler.trigger(undefined);
    const second = first.then(() =>
      reconciler.trigger(undefined).then(() => {
        secondSettled = true;
      })
    );
    await first;
    await vi.waitFor(() => {
      expect(reconcile).toHaveBeenCalledTimes(2);
    });

    expect(secondSettled).toBe(false);
    secondRun.resolve();
    await second;
    expect(secondSettled).toBe(true);
  });

  it('rejects a failed batch but still drains an already-pending batch', async () => {
    const firstRun = deferred<void>();
    const secondRun = deferred<void>();
    const reconcile = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => firstRun.promise)
      .mockImplementationOnce(() => secondRun.promise);
    const reconciler = new StewardAutomationReconciler(reconcile);
    const failure = new Error('first reconciliation failed');
    let pendingSettled = false;

    const failed = reconciler.trigger(undefined);
    const pending = reconciler.trigger(undefined).then(() => {
      pendingSettled = true;
    });
    firstRun.reject(failure);

    await expect(failed).rejects.toBe(failure);
    await vi.waitFor(() => {
      expect(reconcile).toHaveBeenCalledTimes(2);
    });
    expect(pendingSettled).toBe(false);

    secondRun.resolve();
    await pending;
    expect(pendingSettled).toBe(true);
  });
});

describe('registerStewardAutomationReconciliationHooks', () => {
  it('reconciles after gateway_start', async () => {
    const api = createFakeHookApi();
    const { context, list } = cronContext(jobs);
    registerStewardAutomationReconciliationHooks(
      api as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0]
    );

    await api.fire('gateway_start', { port: 3000 }, context);

    expect(list).toHaveBeenCalledWith({ includeDisabled: true });
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
  });

  it.each<PluginHookCronChangedEvent['action']>([
    'added',
    'updated',
    'removed',
    'started',
    'finished',
  ])('reconciles after the %s cron_changed action', async (action) => {
    const api = createFakeHookApi();
    const { context, list } = cronContext(jobs);
    registerStewardAutomationReconciliationHooks(
      api as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0]
    );

    await api.fire('cron_changed', { action, jobId: 'disabled-job' }, context);

    expect(list).toHaveBeenCalledWith({ includeDisabled: true });
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
  });
});
