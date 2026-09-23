import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type StewardAutomationCronWriteService,
  StewardAutomationEditProcessor,
  applyStewardAutomationDispatch,
  deriveStewardAutomationJobId,
  parseStewardAutomationDispatch,
  toStewardAutomationCronCreateInput,
  toStewardAutomationCronPatch,
} from './steward-automation-edit.js';
import { setErrorTelemetryReporter } from './telemetry.js';

const requestId = '0v4.jd3o0';
const jobId = deriveStewardAutomationJobId(requestId);

const createTask = {
  name: 'Daily status',
  enabled: true,
  schedule: { kind: 'cron' as const, expr: '0 9 * * *', tz: 'UTC' },
  sessionTarget: 'isolated',
  wakeMode: 'now',
  payload: { kind: 'agentTurn', message: 'Send the daily status.' },
};

function cronService(
  overrides: Partial<StewardAutomationCronWriteService> = {}
): StewardAutomationCronWriteService & {
  add: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
} {
  return {
    add: vi.fn().mockResolvedValue({ id: jobId }),
    update: vi.fn().mockResolvedValue({ id: 'job-1' }),
    remove: vi.fn().mockResolvedValue({ ok: true, removed: true }),
    ...overrides,
  } as never;
}

describe('parseStewardAutomationDispatch', () => {
  it('parses each verb', () => {
    expect(
      parseStewardAutomationDispatch({
        requestId,
        action: { create: createTask },
      }).action
    ).toEqual({ create: createTask });
    expect(
      parseStewardAutomationDispatch({
        requestId,
        action: { update: { id: 'job-1', enabled: false } },
      }).action
    ).toEqual({ update: { id: 'job-1', enabled: false } });
    expect(
      parseStewardAutomationDispatch({
        requestId,
        action: { delete: { id: 'job-1' } },
      }).action
    ).toEqual({ delete: { id: 'job-1' } });
  });

  function thrownBy(run: () => unknown): unknown {
    try {
      run();
    } catch (error) {
      return error;
    }
    throw new Error('expected a throw');
  }

  it('keeps the request id on a malformed action so it can be answered', () => {
    expect(
      thrownBy(() =>
        parseStewardAutomationDispatch({ requestId, action: { explode: {} } })
      )
    ).toMatchObject({ name: 'StewardAutomationDispatchError', requestId });
  });

  it('reports no request id when the envelope lacks one', () => {
    expect(
      thrownBy(() => parseStewardAutomationDispatch('nope'))
    ).toMatchObject({
      name: 'StewardAutomationDispatchError',
      requestId: null,
    });
  });
});

describe('toStewardAutomationCronCreateInput', () => {
  it('maps a cron-expression create with the derived id', () => {
    expect(toStewardAutomationCronCreateInput(requestId, createTask)).toEqual({
      ok: true,
      value: {
        id: jobId,
        name: 'Daily status',
        enabled: true,
        schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'UTC' },
        sessionTarget: 'isolated',
        wakeMode: 'now',
        payload: { kind: 'agentTurn', message: 'Send the daily status.' },
      },
    });
  });

  it('converts an at schedule from Unix milliseconds to ISO text', () => {
    const result = toStewardAutomationCronCreateInput(requestId, {
      ...createTask,
      schedule: { kind: 'at', at: 1_785_734_301_000 },
    });
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        schedule: {
          kind: 'at',
          at: new Date(1_785_734_301_000).toISOString(),
        },
      }),
    });
  });

  it('rejects an at timestamp outside the Date range as invalid', () => {
    expect(
      toStewardAutomationCronCreateInput(requestId, {
        ...createTask,
        schedule: { kind: 'at', at: 8_640_000_000_000_001 },
      })
    ).toEqual({
      ok: false,
      message: 'schedule.at is outside the representable date range',
    });
  });

  it('maps a systemEvent payload onto text', () => {
    const result = toStewardAutomationCronCreateInput(requestId, {
      ...createTask,
      sessionTarget: 'main',
      payload: { kind: 'systemEvent', message: 'Check in.' },
    });
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        payload: { kind: 'systemEvent', text: 'Check in.' },
      }),
    });
  });

  it.each([
    ['name', { ...createTask, name: undefined }, 'name is required'],
    [
      'schedule',
      { ...createTask, schedule: undefined },
      'schedule is required',
    ],
    [
      'sessionTarget',
      { ...createTask, sessionTarget: undefined },
      'sessionTarget is required',
    ],
    [
      'wakeMode',
      { ...createTask, wakeMode: undefined },
      'wakeMode is required',
    ],
    ['payload', { ...createTask, payload: undefined }, 'payload is required'],
    [
      'schedule.expr',
      { ...createTask, schedule: { kind: 'cron' as const } },
      'schedule.expr is required for a cron schedule',
    ],
    [
      'payload.kind',
      { ...createTask, payload: { kind: 'command', message: 'x' } },
      'payload.kind must be "systemEvent" or "agentTurn", got "command"',
    ],
  ])('rejects a create missing %s', (_field, task, message) => {
    expect(toStewardAutomationCronCreateInput(requestId, task)).toEqual({
      ok: false,
      message,
    });
  });
});

describe('toStewardAutomationCronPatch', () => {
  it('carries only the present fields', () => {
    expect(
      toStewardAutomationCronPatch({
        enabled: false,
        schedule: { kind: 'every', everyMs: 120_000 },
      })
    ).toEqual({
      ok: true,
      value: {
        enabled: false,
        schedule: { kind: 'every', everyMs: 120_000 },
      },
    });
  });

  it('rejects an empty patch', () => {
    expect(toStewardAutomationCronPatch({})).toEqual({
      ok: false,
      message: 'an update must carry at least one field',
    });
  });
});

describe('applyStewardAutomationDispatch', () => {
  it('creates under the derived id and reports it', async () => {
    const cron = cronService();
    const body = await applyStewardAutomationDispatch(
      { requestId, action: { create: createTask } },
      cron
    );
    expect(cron.add).toHaveBeenCalledWith(
      expect.objectContaining({ id: jobId, name: 'Daily status' })
    );
    expect(body).toEqual({ type: 'created', id: jobId });
  });

  it('reports the id the service assigned when it ignores the requested one', async () => {
    const cron = cronService({
      add: vi
        .fn()
        .mockResolvedValue({ id: '5e4dbd9c-c644-4cd0-a900-af54efa4e8e5' }),
    });
    const body = await applyStewardAutomationDispatch(
      { requestId, action: { create: createTask } },
      cron
    );
    expect(body).toEqual({
      type: 'created',
      id: '5e4dbd9c-c644-4cd0-a900-af54efa4e8e5',
    });
  });

  it('reads the id from a declarative add result', async () => {
    const cron = cronService({
      add: vi
        .fn()
        .mockResolvedValue({ created: true, job: { id: 'declared-1' } }),
    });
    const body = await applyStewardAutomationDispatch(
      { requestId, action: { create: createTask } },
      cron
    );
    expect(body).toEqual({ type: 'created', id: 'declared-1' });
  });

  it('falls back to the requested id when add returns nothing usable', async () => {
    const cron = cronService({ add: vi.fn().mockResolvedValue(undefined) });
    const body = await applyStewardAutomationDispatch(
      { requestId, action: { create: createTask } },
      cron
    );
    expect(body).toEqual({ type: 'created', id: jobId });
  });

  it('treats a duplicate-id rejection as the create that already landed', async () => {
    const cron = cronService({
      add: vi
        .fn()
        .mockRejectedValue(new Error(`cron job already exists: ${jobId}`)),
    });
    const body = await applyStewardAutomationDispatch(
      { requestId, action: { create: createTask } },
      cron
    );
    expect(body).toEqual({ type: 'created', id: jobId });
  });

  it('answers invalid without calling the service', async () => {
    const cron = cronService();
    const body = await applyStewardAutomationDispatch(
      { requestId, action: { create: { name: 'No schedule' } } },
      cron
    );
    expect(cron.add).not.toHaveBeenCalled();
    expect(body).toEqual({
      type: 'error',
      errorType: 'invalid',
      message: ['schedule is required'],
    });
  });

  it('patches an existing job', async () => {
    const cron = cronService();
    const body = await applyStewardAutomationDispatch(
      { requestId, action: { update: { id: 'job-1', enabled: false } } },
      cron
    );
    expect(cron.update).toHaveBeenCalledWith('job-1', { enabled: false });
    expect(body).toEqual({ type: 'updated', id: 'job-1' });
  });

  it('maps an unknown id on update to not-found', async () => {
    const cron = cronService({
      update: vi
        .fn()
        .mockRejectedValue(new Error('unknown cron job id: job-9')),
    });
    const body = await applyStewardAutomationDispatch(
      { requestId, action: { update: { id: 'job-9', enabled: false } } },
      cron
    );
    expect(body).toEqual({
      type: 'error',
      errorType: 'not-found',
      message: ['unknown cron job id: job-9'],
    });
  });

  it('maps a thrown service error to harness-error', async () => {
    const cron = cronService({
      add: vi
        .fn()
        .mockRejectedValue(
          new Error('main cron jobs require payload.kind="systemEvent"')
        ),
    });
    const body = await applyStewardAutomationDispatch(
      { requestId, action: { create: createTask } },
      cron
    );
    expect(body).toEqual({
      type: 'error',
      errorType: 'harness-error',
      message: ['main cron jobs require payload.kind="systemEvent"'],
    });
  });

  it('deletes idempotently, treating an already-removed job as deleted', async () => {
    const cron = cronService();
    expect(
      await applyStewardAutomationDispatch(
        { requestId, action: { delete: { id: 'job-1' } } },
        cron
      )
    ).toEqual({ type: 'deleted', id: 'job-1' });
    cron.remove.mockResolvedValue({ ok: true, removed: false });
    expect(
      await applyStewardAutomationDispatch(
        { requestId, action: { delete: { id: 'job-9' } } },
        cron
      )
    ).toEqual({ type: 'deleted', id: 'job-9' });
  });
});

describe('StewardAutomationEditProcessor', () => {
  function processor(
    cron: StewardAutomationCronWriteService | undefined,
    extra: { attempts?: number } = {}
  ) {
    const finalize = vi.fn().mockResolvedValue(undefined);
    const wait = vi.fn().mockResolvedValue(undefined);
    const logger = { log: vi.fn(), warn: vi.fn() };
    const instance = new StewardAutomationEditProcessor({
      finalize,
      getCron: () => cron,
      logger,
      cronWaitMs: 1,
      cronWaitAttempts: extra.attempts ?? 2,
      wait,
    });
    return { instance, finalize, wait, logger };
  }

  it('applies a dispatch and finalizes it with the response envelope', async () => {
    const cron = cronService();
    const { instance, finalize } = processor(cron);

    await instance.handle({ requestId, action: { delete: { id: 'job-1' } } });

    expect(finalize).toHaveBeenCalledOnce();
    expect(finalize).toHaveBeenCalledWith({
      requestId,
      body: { type: 'deleted', id: 'job-1' },
    });
  });

  it('applies dispatches one at a time in arrival order', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const cron = cronService({
      remove: vi.fn().mockImplementation(async (id: string) => {
        order.push(`start ${id}`);
        if (id === 'job-1') {
          await gate;
        }
        order.push(`end ${id}`);
        return { ok: true, removed: true };
      }),
    });
    const { instance } = processor(cron);

    const first = instance.handle({
      requestId: 'a',
      action: { delete: { id: 'job-1' } },
    });
    const second = instance.handle({
      requestId: 'b',
      action: { delete: { id: 'job-2' } },
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(order).toEqual(['start job-1']);

    release();
    await Promise.all([first, second]);
    expect(order).toEqual([
      'start job-1',
      'end job-1',
      'start job-2',
      'end job-2',
    ]);
  });

  it('answers a malformed action as invalid when the id is readable', async () => {
    const { instance, finalize } = processor(cronService());

    await instance.handle({ requestId, action: { explode: {} } });

    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId,
        body: expect.objectContaining({
          type: 'error',
          errorType: 'invalid',
        }),
      })
    );
  });

  it('ignores a fact with no request id', async () => {
    const { instance, finalize, logger } = processor(cronService());

    await instance.handle('garbage');

    expect(finalize).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('waits for the cron service to appear before applying', async () => {
    let cron: StewardAutomationCronWriteService | undefined;
    const finalize = vi.fn().mockResolvedValue(undefined);
    const wait = vi.fn().mockImplementation(async () => {
      cron = cronService();
    });
    const instance = new StewardAutomationEditProcessor({
      finalize,
      getCron: () => cron,
      logger: { warn: vi.fn() },
      cronWaitMs: 1,
      cronWaitAttempts: 5,
      wait,
    });

    await instance.handle({ requestId, action: { delete: { id: 'job-1' } } });

    expect(wait).toHaveBeenCalledOnce();
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId,
        body: { type: 'deleted', id: 'job-1' },
      })
    );
  });

  it('answers harness-error when the cron service never appears', async () => {
    const { instance, finalize, wait } = processor(undefined, { attempts: 2 });

    await instance.handle({ requestId, action: { delete: { id: 'job-1' } } });

    expect(wait).toHaveBeenCalledTimes(2);
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId,
        body: expect.objectContaining({
          type: 'error',
          errorType: 'harness-error',
        }),
      })
    );
  });

  it('answers harness-error when applying throws unexpectedly', async () => {
    const cron = cronService({
      remove: vi.fn().mockImplementation(() => {
        throw new TypeError('cron service exploded');
      }),
    });
    const { instance, finalize } = processor(cron);

    await expect(
      instance.handle({ requestId, action: { delete: { id: 'job-1' } } })
    ).resolves.toBeUndefined();

    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId,
        body: {
          type: 'error',
          errorType: 'harness-error',
          message: ['cron service exploded'],
        },
      })
    );
  });

  it('retries a failed finalize with backoff and then succeeds', async () => {
    const cron = cronService();
    const finalize = vi
      .fn()
      .mockRejectedValueOnce(new Error('poke failed'))
      .mockRejectedValueOnce(new Error('poke failed again'))
      .mockResolvedValue(undefined);
    const wait = vi.fn().mockResolvedValue(undefined);
    const logger = { warn: vi.fn() };
    const instance = new StewardAutomationEditProcessor({
      finalize,
      getCron: () => cron,
      logger,
      finalizeDelaysMs: [10, 20, 40],
      wait,
    });

    await instance.handle({
      requestId: 'a',
      action: { delete: { id: 'job-1' } },
    });

    expect(finalize).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls.map((call) => call[0])).toEqual([10, 20]);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('gives up finalizing after the backoff schedule and keeps processing', async () => {
    const cron = cronService();
    const finalize = vi
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockRejectedValueOnce(new Error('3'))
      .mockResolvedValue(undefined);
    const logger = { warn: vi.fn() };
    const instance = new StewardAutomationEditProcessor({
      finalize,
      getCron: () => cron,
      logger,
      finalizeDelaysMs: [1, 1],
      wait: vi.fn().mockResolvedValue(undefined),
    });

    await instance.handle({
      requestId: 'a',
      action: { delete: { id: 'job-1' } },
    });
    await instance.handle({
      requestId: 'b',
      action: { delete: { id: 'job-2' } },
    });

    expect(finalize).toHaveBeenCalledTimes(4);
    expect(logger.warn.mock.calls.at(-1)?.[0]).toMatch(/giving up/);
  });

  it('drops new facts and stops answering once the monitor aborts', async () => {
    const controller = new AbortController();
    const cron = cronService();
    const finalize = vi.fn().mockResolvedValue(undefined);
    const instance = new StewardAutomationEditProcessor({
      finalize,
      getCron: () => cron,
      logger: { warn: vi.fn() },
      wait: vi.fn().mockResolvedValue(undefined),
      signal: controller.signal,
    });

    controller.abort();
    await instance.handle({
      requestId: 'a',
      action: { delete: { id: 'job-1' } },
    });

    expect(cron.remove).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });

  it('does not finalize a dispatch whose apply outlived the monitor', async () => {
    const controller = new AbortController();
    const finalize = vi.fn().mockResolvedValue(undefined);
    const cron = cronService({
      remove: vi.fn().mockImplementation(async () => {
        controller.abort();
        return { ok: true, removed: true };
      }),
    });
    const instance = new StewardAutomationEditProcessor({
      finalize,
      getCron: () => cron,
      logger: { log: vi.fn(), warn: vi.fn() },
      wait: vi.fn().mockResolvedValue(undefined),
      signal: controller.signal,
    });

    await instance.handle({
      requestId: 'a',
      action: { delete: { id: 'job-1' } },
    });

    expect(cron.remove).toHaveBeenCalledOnce();
    expect(finalize).not.toHaveBeenCalled();
  });
});

describe('StewardAutomationEditProcessor telemetry', () => {
  afterEach(() => {
    setErrorTelemetryReporter(null);
  });

  function captureReports(): { event: { sourceEventName?: string | null } }[] {
    const reports: { event: { sourceEventName?: string | null } }[] = [];
    setErrorTelemetryReporter((report) => {
      reports.push(report as { event: { sourceEventName?: string | null } });
    });
    return reports;
  }

  it('reports a finalize it gave up on, so a stranded edit is findable', async () => {
    const reports = captureReports();
    const instance = new StewardAutomationEditProcessor({
      finalize: vi.fn().mockRejectedValue(new Error('channel down')),
      getCron: () => cronService(),
      logger: { warn: vi.fn() },
      finalizeDelaysMs: [],
      wait: vi.fn().mockResolvedValue(undefined),
    });

    await instance.handle({ requestId, action: { delete: { id: 'job-1' } } });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.event).toMatchObject({
      telemetrySource: 'steward_automation_edit',
      sourceEventName: 'finalize_abandoned',
      errorKind: 'finalize',
    });
  });

  it('reports an edit the cron service threw on', async () => {
    const reports = captureReports();
    const cron = cronService({
      remove: vi.fn().mockImplementation(() => {
        throw new TypeError('cron service exploded');
      }),
    });
    const instance = new StewardAutomationEditProcessor({
      finalize: vi.fn().mockResolvedValue(undefined),
      getCron: () => cron,
      logger: { log: vi.fn(), warn: vi.fn() },
      wait: vi.fn().mockResolvedValue(undefined),
    });

    await instance.handle({ requestId, action: { delete: { id: 'job-1' } } });

    expect(reports.map((report) => report.event.sourceEventName)).toEqual([
      'apply_failed',
    ]);
  });

  it('reports an edit no cron service ever answered', async () => {
    const reports = captureReports();
    const instance = new StewardAutomationEditProcessor({
      finalize: vi.fn().mockResolvedValue(undefined),
      getCron: () => undefined,
      logger: { warn: vi.fn() },
      cronWaitMs: 1,
      cronWaitAttempts: 1,
      wait: vi.fn().mockResolvedValue(undefined),
    });

    await instance.handle({ requestId, action: { delete: { id: 'job-1' } } });

    expect(reports.map((report) => report.event.sourceEventName)).toEqual([
      'cron_unavailable',
    ]);
  });
});

describe('StewardAutomationEditProcessor cancellation', () => {
  it('abandons a finalize backoff as soon as the monitor aborts', async () => {
    const controller = new AbortController();
    const finalize = vi.fn().mockRejectedValue(new Error('channel down'));
    const instance = new StewardAutomationEditProcessor({
      finalize,
      getCron: () => cronService(),
      logger: { warn: vi.fn() },
      // Long enough that only the signal can end the wait.
      finalizeDelaysMs: [600_000],
      signal: controller.signal,
    });

    const run = instance.handle({
      requestId,
      action: { delete: { id: 'job-1' } },
    });
    await vi.waitFor(() => expect(finalize).toHaveBeenCalledOnce());
    controller.abort();

    await expect(run).resolves.toBeUndefined();
    expect(finalize).toHaveBeenCalledOnce();
  });

  it('abandons a wait for the cron service as soon as the monitor aborts', async () => {
    const controller = new AbortController();
    const getCron = vi.fn().mockReturnValue(undefined);
    const instance = new StewardAutomationEditProcessor({
      finalize: vi.fn().mockResolvedValue(undefined),
      getCron,
      logger: { warn: vi.fn() },
      cronWaitMs: 600_000,
      cronWaitAttempts: 30,
      signal: controller.signal,
    });

    const run = instance.handle({
      requestId,
      action: { delete: { id: 'job-1' } },
    });
    await vi.waitFor(() => expect(getCron).toHaveBeenCalled());
    controller.abort();

    await expect(run).resolves.toBeUndefined();
  });
});
