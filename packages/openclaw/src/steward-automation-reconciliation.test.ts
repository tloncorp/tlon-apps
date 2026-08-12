import type {
  PluginHookCronChangedEvent,
  PluginHookGatewayContext,
  PluginHookGatewayCronJob,
} from 'openclaw/plugin-sdk/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { submitStewardAutomationProject } from './steward-automation-adapter.js';
import {
  DEFAULT_STEWARD_AUTOMATION_RETRY_DELAY_MS,
  StewardAutomationCronUnavailableError,
  StewardAutomationReconciler,
  StewardAutomationReconciliationCancelledError,
  getStewardAutomationReconciler,
  reconcileStewardAutomation,
  registerStewardAutomationReconciliationHooks,
  setStewardAutomationReconciler,
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
    payload: { kind: 'agentTurn', message: id },
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
    payload: { kind: 'agentTurn', message: 'check status' },
    state: { lastRunStatus: 'ok', lastRunAtMs: 1_777_000_000_000 },
    createdAtMs: 1_700_000_000_000,
  },
] satisfies PluginHookGatewayCronJob[];

beforeEach(() => {
  getStewardAutomationReconciler()?.stop();
  setStewardAutomationReconciler(null);
  vi.mocked(submitStewardAutomationProject).mockReset();
  vi.mocked(submitStewardAutomationProject).mockResolvedValue(undefined);
});

afterEach(() => {
  getStewardAutomationReconciler()?.stop();
  setStewardAutomationReconciler(null);
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
            payload: { kind: 'agentTurn', message: 'check status' },
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

    const first = reconciler.start(() => ({ list: list1 }));
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

    const first = reconciler.start(firstContext.context.getCron);
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

    const first = reconciler.start(undefined);
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

    const first = reconciler.start(undefined).then(() => {
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

      const initial = reconciler.start(unavailable);
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

  it('preserves a delivered snapshot until unavailable startup recovers', async () => {
    const { delay, waits } = controlledRetryDelay();
    const previous = cronContext([job('previous')]);
    const latest = cronContext([job('latest')]);
    const reconciler = new StewardAutomationReconciler(
      reconcileStewardAutomation,
      delay
    );

    await reconciler.start(previous.context.getCron);
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).toHaveBeenLastCalledWith({
      project: { tasks: [expect.objectContaining({ id: 'previous' })] },
    });

    reconciler.stop();
    let startupSettled = false;
    const startup = reconciler.start(undefined).then(() => {
      startupSettled = true;
    });
    await vi.waitFor(() => expect(delay).toHaveBeenCalledOnce());

    let recoverySettled = false;
    const recovery = reconciler.trigger(latest.context.getCron).then(() => {
      recoverySettled = true;
    });
    expect(startupSettled).toBe(false);
    expect(recoverySettled).toBe(false);
    expect(latest.list).not.toHaveBeenCalled();
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).toHaveBeenLastCalledWith({
      project: { tasks: [expect.objectContaining({ id: 'previous' })] },
    });

    waits[0].resolve();
    await Promise.all([startup, recovery]);

    expect(startupSettled).toBe(true);
    expect(recoverySettled).toBe(true);
    expect(latest.list).toHaveBeenCalledOnce();
    expect(latest.list).toHaveBeenCalledWith({ includeDisabled: true });
    expect(submitStewardAutomationProject).toHaveBeenCalledTimes(2);
    expect(submitStewardAutomationProject).toHaveBeenLastCalledWith({
      project: { tasks: [expect.objectContaining({ id: 'latest' })] },
    });
  });

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

    const result = reconciler.start(() => ({ list }));
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

    const result = reconciler.start(() => ({ list }));
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

    const initial = reconciler.start(() => ({ list: firstList }));
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

    const result = reconciler.start(() => ({ list }));
    await vi.waitFor(() => expect(delay).toHaveBeenCalledOnce());
    expect(submitStewardAutomationProject).not.toHaveBeenCalled();

    waits[0].resolve();
    await result;
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).toHaveBeenCalledWith({
      project: { tasks: [] },
    });
  });

  it('cancels an active retry delay and does not start another attempt', async () => {
    const retryStarted = deferred<void>();
    const delay = vi.fn((_delayMs: number, signal?: AbortSignal) => {
      retryStarted.resolve();
      return new Promise<void>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
      });
    });
    const reconcile = vi.fn().mockRejectedValue(new Error('offline'));
    const reconciler = new StewardAutomationReconciler(reconcile, delay);

    const result = reconciler.start(undefined);
    const cancelled = expect(result).rejects.toBeInstanceOf(
      StewardAutomationReconciliationCancelledError
    );
    await retryStarted.promise;
    reconciler.stop();
    await cancelled;

    expect(reconcile).toHaveBeenCalledOnce();
    expect(delay).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).not.toHaveBeenCalled();
  });

  it('stops during an outstanding list without submitting or retrying', async () => {
    const listed = deferred<PluginHookGatewayCronJob[]>();
    const list = vi.fn(() => listed.promise);
    const delay = vi.fn();
    const reconciler = new StewardAutomationReconciler(
      reconcileStewardAutomation,
      delay
    );

    const result = reconciler.start(() => ({ list }));
    const cancelled = expect(result).rejects.toMatchObject({
      name: 'StewardAutomationReconciliationCancelledError',
      reason: 'gateway-stop',
    });
    reconciler.stop();
    listed.resolve([]);
    await cancelled;
    await vi.waitFor(() => expect(list).toHaveBeenCalledOnce());

    expect(delay).not.toHaveBeenCalled();
    expect(submitStewardAutomationProject).not.toHaveBeenCalled();
  });

  it('checks the active epoch at an injected pre-submit boundary', async () => {
    const atBoundary = deferred<void>();
    const releaseBoundary = deferred<void>();
    const reconcile = (
      getCron: Parameters<typeof reconcileStewardAutomation>[0],
      _beforeSubmit?: () => void | Promise<void>,
      assertCanSubmit?: () => void
    ) =>
      reconcileStewardAutomation(
        getCron,
        async () => {
          atBoundary.resolve();
          await releaseBoundary.promise;
        },
        assertCanSubmit
      );
    const reconciler = new StewardAutomationReconciler(reconcile);
    const { context } = cronContext([job('stale')]);

    const result = reconciler.start(context.getCron);
    const cancelled = expect(result).rejects.toBeInstanceOf(
      StewardAutomationReconciliationCancelledError
    );
    await atBoundary.promise;
    reconciler.stop();
    releaseBoundary.resolve();
    await cancelled;

    expect(submitStewardAutomationProject).not.toHaveBeenCalled();
  });

  it('clears coalesced pending triggers when the gateway stops', async () => {
    const listed = deferred<PluginHookGatewayCronJob[]>();
    const firstList = vi.fn(() => listed.promise);
    const pendingList = vi.fn().mockResolvedValue([]);
    const reconciler = new StewardAutomationReconciler();

    const first = reconciler.start(() => ({ list: firstList }));
    const pending1 = reconciler.trigger(() => ({ list: pendingList }));
    const pending2 = reconciler.trigger(() => ({ list: pendingList }));
    const cancellations = [first, pending1, pending2].map((promise) =>
      expect(promise).rejects.toBeInstanceOf(
        StewardAutomationReconciliationCancelledError
      )
    );

    reconciler.stop();
    listed.resolve([]);
    await Promise.all(cancellations);
    await vi.waitFor(() => expect(firstList).toHaveBeenCalledOnce());

    expect(pendingList).not.toHaveBeenCalled();
    expect(submitStewardAutomationProject).not.toHaveBeenCalled();
  });

  it('restarts with one fresh snapshot and blocks the stale prior epoch', async () => {
    const staleListResult = deferred<PluginHookGatewayCronJob[]>();
    const staleList = vi.fn(() => staleListResult.promise);
    const freshList = vi.fn().mockResolvedValue([job('fresh')]);
    const reconciler = new StewardAutomationReconciler();

    const stale = reconciler.start(() => ({ list: staleList }));
    const staleCancelled = expect(stale).rejects.toMatchObject({
      name: 'StewardAutomationReconciliationCancelledError',
      reason: 'gateway-stop',
    });
    reconciler.stop();
    const fresh = reconciler.start(() => ({ list: freshList }));

    staleListResult.resolve([job('stale')]);
    await staleCancelled;
    await fresh;

    expect(staleList).toHaveBeenCalledOnce();
    expect(freshList).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).toHaveBeenCalledWith({
      project: { tasks: [expect.objectContaining({ id: 'fresh' })] },
    });
  });
});

describe('registerStewardAutomationReconciliationHooks', () => {
  const registrationOptions = () => ({
    logger: { warn: vi.fn() },
  });
  it('registers gateway_stop and ignores cron changes while inactive', async () => {
    const api = createFakeHookApi();
    const { context, list } = cronContext(jobs);
    registerStewardAutomationReconciliationHooks(
      api as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0],
      registrationOptions()
    );

    expect(api.on).toHaveBeenCalledWith('gateway_stop', expect.any(Function));
    await api.fire(
      'cron_changed',
      { action: 'added', jobId: 'disabled-job' },
      context
    );
    expect(list).not.toHaveBeenCalled();

    await api.fire('gateway_start', { port: 3000 }, context);
    await vi.waitFor(() => {
      expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    });
    await api.fire('gateway_stop', { reason: 'shutdown' }, context);
    list.mockClear();
    vi.mocked(submitStewardAutomationProject).mockClear();

    await api.fire(
      'cron_changed',
      { action: 'removed', jobId: 'disabled-job' },
      context
    );
    expect(list).not.toHaveBeenCalled();
    expect(submitStewardAutomationProject).not.toHaveBeenCalled();
  });

  it('reconciles after gateway_start', async () => {
    const api = createFakeHookApi();
    const { context, list } = cronContext(jobs);
    registerStewardAutomationReconciliationHooks(
      api as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0],
      registrationOptions()
    );

    await api.fire('gateway_start', { port: 3000 }, context);
    await vi.waitFor(() => {
      expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    });

    expect(list).toHaveBeenCalledWith({ includeDisabled: true });
  });

  it.each<{
    category: 'definition' | 'execution';
    action: PluginHookCronChangedEvent['action'];
  }>([
    { category: 'definition', action: 'added' },
    { category: 'definition', action: 'updated' },
    { category: 'definition', action: 'removed' },
    { category: 'execution', action: 'started' },
    { category: 'execution', action: 'finished' },
  ])(
    'rereads the complete list after the $category $action event',
    async ({ action }) => {
      const api = createFakeHookApi();
      const completeJobs = [
        {
          id: 'complete-enabled',
          enabled: true,
          payload: { kind: 'agentTurn', message: 'first in complete list' },
        },
        {
          id: 'complete-disabled',
          enabled: false,
          payload: { kind: 'agentTurn', message: 'second in complete list' },
        },
      ] satisfies PluginHookGatewayCronJob[];
      const { context, list } = cronContext(completeJobs);
      registerStewardAutomationReconciliationHooks(
        api as unknown as Parameters<
          typeof registerStewardAutomationReconciliationHooks
        >[0],
        registrationOptions()
      );

      await api.fire('gateway_start', { port: 3000 }, context);
      await vi.waitFor(() => {
        expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
      });
      list.mockClear();
      vi.mocked(submitStewardAutomationProject).mockClear();

      await api.fire(
        'cron_changed',
        {
          action,
          jobId: 'event-only',
          job: {
            id: 'event-only',
            enabled: true,
            payload: { kind: 'agentTurn', message: 'event delta' },
            state: { lastRunStatus: 'ok' },
          },
        },
        context
      );
      await vi.waitFor(() => {
        expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
      });

      expect(list).toHaveBeenCalledOnce();
      expect(list).toHaveBeenCalledWith({ includeDisabled: true });
      expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
      expect(submitStewardAutomationProject).toHaveBeenCalledWith({
        project: {
          tasks: [
            {
              id: 'complete-enabled',
              enabled: true,
              payload: {
                kind: 'agentTurn',
                message: 'first in complete list',
              },
            },
            {
              id: 'complete-disabled',
              enabled: false,
              payload: {
                kind: 'agentTurn',
                message: 'second in complete list',
              },
            },
          ],
        },
      });
    }
  );

  it('reuses one reconciler across discovery, full, and prewarm registries', async () => {
    const discoveryApi = createFakeHookApi();
    const fullApi = createFakeHookApi();
    const prewarmApi = createFakeHookApi();
    const options = registrationOptions();
    const discovery = registerStewardAutomationReconciliationHooks(
      discoveryApi as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0],
      options
    );
    const full = registerStewardAutomationReconciliationHooks(
      fullApi as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0],
      options
    );
    const initial = cronContext([job('initial')]);

    expect(full).toBe(discovery);
    expect(getStewardAutomationReconciler()).toBe(discovery);
    await fullApi.fire('gateway_start', { port: 3000 }, initial.context);
    await vi.waitFor(() => {
      expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    });

    const prewarm = registerStewardAutomationReconciliationHooks(
      prewarmApi as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0],
      options
    );
    const changed = cronContext([job('changed')]);
    expect(prewarm).toBe(discovery);
    await prewarmApi.fire(
      'cron_changed',
      { action: 'updated', jobId: 'changed' },
      changed.context
    );
    await vi.waitFor(() => {
      expect(submitStewardAutomationProject).toHaveBeenCalledTimes(2);
    });

    await prewarmApi.fire(
      'gateway_stop',
      { reason: 'shutdown' },
      changed.context
    );
    const ignored = cronContext([job('ignored')]);
    await discoveryApi.fire(
      'cron_changed',
      { action: 'removed', jobId: 'changed' },
      ignored.context
    );
    expect(ignored.list).not.toHaveBeenCalled();

    const restarted = cronContext([job('restarted')]);
    await discoveryApi.fire('gateway_start', { port: 3001 }, restarted.context);
    await vi.waitFor(() => {
      expect(submitStewardAutomationProject).toHaveBeenCalledTimes(3);
    });
    expect(restarted.list).toHaveBeenCalledOnce();
  });

  it('treats duplicate gateway_start delivery as idempotent', async () => {
    const api1 = createFakeHookApi();
    const api2 = createFakeHookApi();
    const options = registrationOptions();
    registerStewardAutomationReconciliationHooks(
      api1 as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0],
      options
    );
    registerStewardAutomationReconciliationHooks(
      api2 as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0],
      options
    );
    const initial = cronContext([job('initial')]);
    const duplicate = cronContext([job('duplicate')]);

    await api1.fire('gateway_start', { port: 3000 }, initial.context);
    await vi.waitFor(() => {
      expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    });
    await api2.fire('gateway_start', { port: 3000 }, duplicate.context);
    await Promise.resolve();

    expect(initial.list).toHaveBeenCalledOnce();
    expect(duplicate.list).not.toHaveBeenCalled();
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
  });

  it('dispatches projection work without awaiting an outstanding list', async () => {
    const api = createFakeHookApi();
    const options = registrationOptions();
    const listed = deferred<PluginHookGatewayCronJob[]>();
    const list = vi.fn(() => listed.promise);
    registerStewardAutomationReconciliationHooks(
      api as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0],
      options
    );

    await api.fire(
      'gateway_start',
      { port: 3000 },
      {
        getCron: () => ({ list }),
      }
    );

    expect(list).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).not.toHaveBeenCalled();
    await api.fire('gateway_stop', { reason: 'shutdown' }, {});
    listed.resolve([]);
    await Promise.resolve();
    expect(options.logger.warn).not.toHaveBeenCalled();
  });

  it('suppresses cancellation but logs unexpected terminal errors without suppressing another hook', async () => {
    const api = createFakeHookApi();
    const options = registrationOptions();
    const terminal = new Error('terminal projection failure');
    const injected = {
      start: vi.fn().mockRejectedValue(terminal),
      trigger: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
    } as unknown as StewardAutomationReconciler;
    setStewardAutomationReconciler(injected);
    const telemetry = vi.fn();
    registerStewardAutomationReconciliationHooks(
      api as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0],
      options
    );
    api.on('gateway_start', telemetry);

    await api.fire('gateway_start', { port: 3000 }, { getCron: undefined });

    expect(telemetry).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(options.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('terminal projection failure')
      );
    });
    expect(getStewardAutomationReconciler()).toBe(injected);
  });

  it('contains a logger failure while observing a terminal rejection', async () => {
    const api = createFakeHookApi();
    const terminal = new Error('terminal projection failure');
    const injected = {
      start: vi.fn().mockRejectedValue(terminal),
      trigger: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
    } as unknown as StewardAutomationReconciler;
    const warn = vi.fn(() => {
      throw new Error('logger unavailable');
    });
    setStewardAutomationReconciler(injected);
    registerStewardAutomationReconciliationHooks(
      api as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0],
      { logger: { warn } }
    );

    await api.fire('gateway_start', { port: 3000 }, { getCron: undefined });
    await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());
  });
});
