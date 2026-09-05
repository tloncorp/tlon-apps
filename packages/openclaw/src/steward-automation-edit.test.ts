import { describe, expect, it, vi } from 'vitest';

import {
  STEWARD_AUTOMATION_ACTION_MARK,
  type StewardAutomationCronWriteService,
  StewardAutomationEditProcessor,
  applyStewardAutomationDispatch,
  buildStewardAutomationFinalize,
  deriveStewardAutomationJobId,
  parseStewardAutomationDispatch,
  toStewardAutomationCronCreateInput,
  toStewardAutomationCronPatch,
} from './steward-automation-edit.js';

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

  it('deletes, and reports not-found when nothing was removed', async () => {
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
    ).toEqual({
      type: 'error',
      errorType: 'not-found',
      message: ['unknown cron job id: job-9'],
    });
  });
});

describe('StewardAutomationEditProcessor', () => {
  function processor(
    cron: StewardAutomationCronWriteService | undefined,
    extra: { attempts?: number } = {}
  ) {
    const poke = vi.fn().mockResolvedValue(undefined);
    const wait = vi.fn().mockResolvedValue(undefined);
    const logger = { log: vi.fn(), warn: vi.fn() };
    const instance = new StewardAutomationEditProcessor({
      poke,
      getCron: () => cron,
      logger,
      cronWaitMs: 1,
      cronWaitAttempts: extra.attempts ?? 2,
      wait,
    });
    return { instance, poke, wait, logger };
  }

  it('applies a dispatch and pokes the typed finalize under the action mark', async () => {
    const cron = cronService();
    const { instance, poke } = processor(cron);

    await instance.handle({ requestId, action: { delete: { id: 'job-1' } } });

    expect(poke).toHaveBeenCalledOnce();
    expect(poke).toHaveBeenCalledWith({
      app: 'steward',
      mark: STEWARD_AUTOMATION_ACTION_MARK,
      json: buildStewardAutomationFinalize(requestId, {
        type: 'deleted',
        id: 'job-1',
      }),
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
    const { instance, poke } = processor(cronService());

    await instance.handle({ requestId, action: { explode: {} } });

    expect(poke).toHaveBeenCalledWith(
      expect.objectContaining({
        json: {
          finalize: {
            requestId,
            body: expect.objectContaining({
              type: 'error',
              errorType: 'invalid',
            }),
          },
        },
      })
    );
  });

  it('ignores a fact with no request id', async () => {
    const { instance, poke, logger } = processor(cronService());

    await instance.handle('garbage');

    expect(poke).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('waits for the cron service to appear before applying', async () => {
    let cron: StewardAutomationCronWriteService | undefined;
    const poke = vi.fn().mockResolvedValue(undefined);
    const wait = vi.fn().mockImplementation(async () => {
      cron = cronService();
    });
    const instance = new StewardAutomationEditProcessor({
      poke,
      getCron: () => cron,
      logger: { warn: vi.fn() },
      cronWaitMs: 1,
      cronWaitAttempts: 5,
      wait,
    });

    await instance.handle({ requestId, action: { delete: { id: 'job-1' } } });

    expect(wait).toHaveBeenCalledOnce();
    expect(poke).toHaveBeenCalledWith(
      expect.objectContaining({
        json: {
          finalize: { requestId, body: { type: 'deleted', id: 'job-1' } },
        },
      })
    );
  });

  it('answers harness-error when the cron service never appears', async () => {
    const { instance, poke, wait } = processor(undefined, { attempts: 2 });

    await instance.handle({ requestId, action: { delete: { id: 'job-1' } } });

    expect(wait).toHaveBeenCalledTimes(2);
    expect(poke).toHaveBeenCalledWith(
      expect.objectContaining({
        json: {
          finalize: {
            requestId,
            body: expect.objectContaining({
              type: 'error',
              errorType: 'harness-error',
            }),
          },
        },
      })
    );
  });

  it('survives a failed finalize poke and keeps processing', async () => {
    const cron = cronService();
    const poke = vi
      .fn()
      .mockRejectedValueOnce(new Error('poke failed'))
      .mockResolvedValue(undefined);
    const logger = { warn: vi.fn() };
    const instance = new StewardAutomationEditProcessor({
      poke,
      getCron: () => cron,
      logger,
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

    expect(poke).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
