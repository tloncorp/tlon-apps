import type {
  PluginHookCronChangedEvent,
  PluginHookGatewayContext,
  PluginHookGatewayCronJob,
} from 'openclaw/plugin-sdk/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { submitStewardAutomationProject } from './steward-automation-adapter.js';
import {
  DEFAULT_STEWARD_AUTOMATION_RETRY_DELAY_MS,
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

function controlledRetryDelay() {
  const waits: ReturnType<typeof deferred<void>>[] = [];
  const delay = vi.fn((delayMs: number) => {
    expect(delayMs).toBe(DEFAULT_STEWARD_AUTOMATION_RETRY_DELAY_MS);
    const wait = deferred<void>();
    waits.push(wait);
    return wait.promise;
  });
  return { delay, waits };
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

  it('keeps covered promises pending until a failed attempt retries successfully', async () => {
    const firstRun = deferred<void>();
    const secondRun = deferred<void>();
    const { delay, waits } = controlledRetryDelay();
    const reconcile = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => firstRun.promise)
      .mockImplementationOnce(() => secondRun.promise);
    const reconciler = new StewardAutomationReconciler(reconcile, delay);
    let firstSettled = false;
    let pendingSettled = false;

    const first = reconciler.trigger(undefined).then(() => {
      firstSettled = true;
    });
    const pending = reconciler.trigger(undefined).then(() => {
      pendingSettled = true;
    });
    firstRun.reject(new Error('first reconciliation failed'));

    await vi.waitFor(() => expect(delay).toHaveBeenCalledOnce());
    expect(firstSettled).toBe(false);
    expect(pendingSettled).toBe(false);
    expect(reconcile).toHaveBeenCalledOnce();

    waits[0].resolve();
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));
    expect(firstSettled).toBe(false);
    expect(pendingSettled).toBe(false);

    secondRun.resolve();
    await Promise.all([first, pending]);
    expect(firstSettled).toBe(true);
    expect(pendingSettled).toBe(true);
  });

  it.each([
    ['missing accessor', undefined],
    ['missing service', () => undefined],
  ])(
    'recovers from an initially %s using the latest accessor',
    async (_label, unavailable) => {
      const { delay, waits } = controlledRetryDelay();
      const recovered = cronContext([job('recovered')]);
      const reconciler = new StewardAutomationReconciler(
        reconcileStewardAutomation,
        delay
      );

      const initial = reconciler.trigger(unavailable);
      await vi.waitFor(() => expect(delay).toHaveBeenCalledOnce());
      const repair = reconciler.trigger(recovered.context.getCron);

      expect(recovered.list).not.toHaveBeenCalled();
      expect(submitStewardAutomationProject).not.toHaveBeenCalled();
      waits[0].resolve();
      await Promise.all([initial, repair]);

      expect(recovered.list).toHaveBeenCalledOnce();
      expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    }
  );

  it('retries a failed list without submitting an empty projection', async () => {
    const { delay, waits } = controlledRetryDelay();
    const list = vi
      .fn()
      .mockRejectedValueOnce(new Error('cron unavailable'))
      .mockResolvedValueOnce([job('after-list-recovery')]);
    const reconciler = new StewardAutomationReconciler(
      reconcileStewardAutomation,
      delay
    );

    const result = reconciler.trigger(() => ({ list }));
    await vi.waitFor(() => expect(delay).toHaveBeenCalledOnce());
    expect(submitStewardAutomationProject).not.toHaveBeenCalled();

    waits[0].resolve();
    await result;
    expect(list).toHaveBeenCalledTimes(2);
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).toHaveBeenCalledWith({
      project: {
        tasks: [expect.objectContaining({ id: 'after-list-recovery' })],
      },
    });
  });

  it('retries normalization and submission failures as complete operations', async () => {
    const { delay, waits } = controlledRetryDelay();
    const invalid = {
      ...job('invalid'),
      schedule: { kind: 'future-schedule' },
    } as unknown as PluginHookGatewayCronJob;
    const list = vi
      .fn()
      .mockResolvedValueOnce([invalid])
      .mockResolvedValue([job('valid')]);
    vi.mocked(submitStewardAutomationProject)
      .mockRejectedValueOnce(new Error('poke nack'))
      .mockResolvedValueOnce(undefined);
    const reconciler = new StewardAutomationReconciler(
      reconcileStewardAutomation,
      delay
    );

    const result = reconciler.trigger(() => ({ list }));
    await vi.waitFor(() => expect(delay).toHaveBeenCalledTimes(1));
    expect(submitStewardAutomationProject).not.toHaveBeenCalled();
    waits[0].resolve();

    await vi.waitFor(() => expect(delay).toHaveBeenCalledTimes(2));
    expect(list).toHaveBeenCalledTimes(2);
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    waits[1].resolve();

    await result;
    expect(list).toHaveBeenCalledTimes(3);
    expect(submitStewardAutomationProject).toHaveBeenCalledTimes(2);
    expect(submitStewardAutomationProject).toHaveBeenLastCalledWith({
      project: { tasks: [expect.objectContaining({ id: 'valid' })] },
    });
  });

  it('schedules one delay for a failed burst and retries with only the latest accessor', async () => {
    const failedList = deferred<PluginHookGatewayCronJob[]>();
    const { delay, waits } = controlledRetryDelay();
    const firstList = vi.fn(() => failedList.promise);
    const staleList = vi.fn().mockResolvedValue([job('stale')]);
    const latestList = vi.fn().mockResolvedValue([job('latest')]);
    const reconciler = new StewardAutomationReconciler(
      reconcileStewardAutomation,
      delay
    );

    const initial = reconciler.trigger(() => ({ list: firstList }));
    const stale = Array.from({ length: 6 }, () =>
      reconciler.trigger(() => ({ list: staleList }))
    );
    failedList.reject(new Error('list failed'));
    await vi.waitFor(() => expect(delay).toHaveBeenCalledOnce());
    const latest = reconciler.trigger(() => ({ list: latestList }));

    expect(staleList).not.toHaveBeenCalled();
    expect(latestList).not.toHaveBeenCalled();
    waits[0].resolve();
    await Promise.all([initial, ...stale, latest]);

    expect(delay).toHaveBeenCalledOnce();
    expect(staleList).not.toHaveBeenCalled();
    expect(latestList).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
  });

  it('submits an empty project only after an actual successful empty list', async () => {
    const { delay, waits } = controlledRetryDelay();
    const list = vi
      .fn()
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValueOnce([]);
    const reconciler = new StewardAutomationReconciler(
      reconcileStewardAutomation,
      delay
    );

    const result = reconciler.trigger(() => ({ list }));
    await vi.waitFor(() => expect(delay).toHaveBeenCalledOnce());
    expect(submitStewardAutomationProject).not.toHaveBeenCalled();

    waits[0].resolve();
    await result;
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).toHaveBeenCalledWith({
      project: { tasks: [] },
    });
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
