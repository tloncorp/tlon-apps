import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _testing,
  buildCronJobChangedReport,
  buildCronRunReport,
  buildCronSnapshotReport,
  clearCronServiceAccessor,
  cronScheduleFields,
  emitCronSnapshot,
  handleCronChangedEvent,
  normalizeCronSessionTargetKind,
  scheduleCronSnapshot,
  setCronServiceAccessor,
  summarizeCronJobs,
  truncateCronError,
} from './cron-telemetry.js';
import {
  type TlonCronTelemetryReport,
  setCronTelemetryReporter,
} from './telemetry.js';

type HookCronJob = Parameters<typeof summarizeCronJobs>[0][number];
type HookCronEvent = Parameters<typeof buildCronRunReport>[0];

function makeJob(overrides: Partial<HookCronJob> = {}): HookCronJob {
  return {
    id: 'job-1',
    name: 'morning briefing',
    enabled: true,
    schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'America/New_York' },
    sessionTarget: 'isolated',
    wakeMode: 'now',
    payload: { kind: 'agentTurn', text: 'secret prompt text' },
    createdAtMs: 1_000,
    updatedAtMs: 2_000,
    ...overrides,
  };
}

function makeOnExitJob(overrides: Partial<HookCronJob> = {}): HookCronJob {
  return {
    ...makeJob(overrides),
    // The pinned 2026.5.28 SDK does not include this newer runtime shape.
    schedule: {
      kind: 'on-exit',
      command: 'secret watcher command --token sensitive',
      cwd: '/private/watcher/path',
    } as unknown as HookCronJob['schedule'],
  };
}

function makeFinishedEvent(
  overrides: Partial<HookCronEvent> = {}
): HookCronEvent {
  return {
    action: 'finished',
    jobId: 'job-1',
    job: makeJob(),
    sessionTarget: 'isolated',
    agentId: 'agent-main',
    runAtMs: 10_000,
    durationMs: 1_234,
    status: 'ok',
    delivered: true,
    deliveryStatus: 'delivered',
    sessionId: 'sess-1',
    sessionKey: 'cron:job-1',
    runId: 'run-1',
    nextRunAtMs: 20_000,
    model: 'claude-sonnet-5',
    provider: 'anthropic',
    summary: 'secret run output',
    ...overrides,
  };
}

describe('cron telemetry builders', () => {
  it('extracts cron schedule fields', () => {
    expect(cronScheduleFields(makeJob())).toEqual({
      scheduleKind: 'cron',
      scheduleExpr: '0 9 * * *',
      scheduleTz: 'America/New_York',
      scheduleEveryMs: null,
      scheduleAt: null,
    });
  });

  it('extracts every/at schedule fields', () => {
    expect(
      cronScheduleFields(
        makeJob({ schedule: { kind: 'every', everyMs: 3_600_000 } })
      )
    ).toMatchObject({ scheduleKind: 'every', scheduleEveryMs: 3_600_000 });
    expect(
      cronScheduleFields(
        makeJob({ schedule: { kind: 'at', at: '2026-07-09T12:00:00Z' } })
      )
    ).toMatchObject({ scheduleKind: 'at', scheduleAt: '2026-07-09T12:00:00Z' });
    expect(cronScheduleFields(undefined)).toMatchObject({
      scheduleKind: null,
    });
  });

  it('extracts only the kind from forward-compatible on-exit schedules', () => {
    const fields = cronScheduleFields(makeOnExitJob());
    expect(fields).toEqual({
      scheduleKind: 'on-exit',
      scheduleExpr: null,
      scheduleTz: null,
      scheduleEveryMs: null,
      scheduleAt: null,
    });
    expect(JSON.stringify(fields)).not.toContain('secret watcher');
    expect(JSON.stringify(fields)).not.toContain('/private/watcher/path');
  });

  it('normalizes session target kinds without leaking session keys', () => {
    expect(normalizeCronSessionTargetKind('main')).toBe('main');
    expect(normalizeCronSessionTargetKind('isolated')).toBe('isolated');
    expect(normalizeCronSessionTargetKind('current')).toBe('current');
    expect(normalizeCronSessionTargetKind('session:agent:main:xyz')).toBe(
      'session'
    );
    expect(normalizeCronSessionTargetKind('something-else')).toBe('unknown');
    expect(normalizeCronSessionTargetKind(undefined)).toBeNull();
    expect(normalizeCronSessionTargetKind('  ')).toBeNull();
  });

  it('truncates long error text', () => {
    expect(truncateCronError(undefined)).toBeNull();
    expect(truncateCronError('  ')).toBeNull();
    expect(truncateCronError('boom')).toBe('boom');
    const long = 'x'.repeat(600);
    const truncated = truncateCronError(long);
    expect(truncated).toHaveLength(501);
    expect(truncated?.endsWith('…')).toBe(true);
  });

  it('summarizes job counts by enabled state and schedule kind', () => {
    const jobs = [
      makeJob(),
      makeJob({ id: 'job-2', enabled: false }),
      makeJob({ id: 'job-3', schedule: { kind: 'every', everyMs: 60_000 } }),
      makeJob({ id: 'job-4', schedule: { kind: 'at', at: 'soon' } }),
      makeJob({ id: 'job-5', enabled: undefined, schedule: undefined }),
      makeOnExitJob({ id: 'job-6' }),
    ];
    expect(summarizeCronJobs(jobs)).toEqual({
      activeCronJobCount: 5,
      totalCronJobCount: 6,
      scheduleKindCronCount: 2,
      scheduleKindEveryCount: 1,
      scheduleKindAtCount: 1,
      scheduleKindOnExitCount: 1,
    });
  });

  it('builds a run report from a finished event without prompt or summary', () => {
    const report = buildCronRunReport(makeFinishedEvent());
    expect(report).toEqual({
      jobId: 'job-1',
      jobName: 'morning briefing',
      agentId: 'agent-main',
      runId: 'run-1',
      status: 'ok',
      cronError: null,
      durationMs: 1_234,
      runAtMs: 10_000,
      nextRunAtMs: 20_000,
      delivered: true,
      deliveryStatus: 'delivered',
      deliveryError: null,
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      payloadKind: 'agentTurn',
      sessionTargetKind: 'isolated',
      scheduleKind: 'cron',
      scheduleExpr: '0 9 * * *',
      scheduleTz: 'America/New_York',
      scheduleEveryMs: null,
      scheduleAt: null,
    });
    expect(JSON.stringify(report)).not.toContain('secret');
  });

  it('preserves on-exit kind on run reports without leaking its command', () => {
    const report = buildCronRunReport(
      makeFinishedEvent({ job: makeOnExitJob() })
    );
    expect(report).toMatchObject({ scheduleKind: 'on-exit' });
    expect(JSON.stringify(report)).not.toContain('secret watcher');
    expect(JSON.stringify(report)).not.toContain('/private/watcher/path');
  });

  it('builds a run report for failures with error text', () => {
    const report = buildCronRunReport(
      makeFinishedEvent({
        status: 'error',
        error: 'model timed out',
        delivered: false,
        deliveryStatus: 'not-delivered',
        deliveryError: 'channel unavailable',
      })
    );
    expect(report).toMatchObject({
      status: 'error',
      cronError: 'model timed out',
      delivered: false,
      deliveryStatus: 'not-delivered',
      deliveryError: 'channel unavailable',
    });
  });

  it('returns null run reports for non-finished actions', () => {
    expect(buildCronRunReport(makeFinishedEvent({ action: 'started' }))).toBe(
      null
    );
    expect(buildCronRunReport(makeFinishedEvent({ action: 'added' }))).toBe(
      null
    );
  });

  it('builds job-changed reports for lifecycle actions only', () => {
    const added = buildCronJobChangedReport(
      { action: 'added', jobId: 'job-1', job: makeJob() },
      { activeCronJobCount: 3, totalCronJobCount: 4 }
    );
    expect(added).toEqual({
      cronAction: 'added',
      jobId: 'job-1',
      jobName: 'morning briefing',
      agentId: null,
      enabled: true,
      wakeMode: 'now',
      payloadKind: 'agentTurn',
      sessionTargetKind: 'isolated',
      scheduleKind: 'cron',
      scheduleExpr: '0 9 * * *',
      scheduleTz: 'America/New_York',
      scheduleEveryMs: null,
      scheduleAt: null,
      activeCronJobCount: 3,
      totalCronJobCount: 4,
    });
    expect(JSON.stringify(added)).not.toContain('secret');

    const onExitAdded = buildCronJobChangedReport(
      { action: 'added', jobId: 'job-on-exit', job: makeOnExitJob() },
      { activeCronJobCount: 4, totalCronJobCount: 5 }
    );
    expect(onExitAdded).toMatchObject({ scheduleKind: 'on-exit' });
    expect(JSON.stringify(onExitAdded)).not.toContain('secret watcher');
    expect(JSON.stringify(onExitAdded)).not.toContain('/private/watcher/path');

    expect(
      buildCronJobChangedReport({ action: 'removed', jobId: 'job-1' }, null)
    ).toMatchObject({
      cronAction: 'removed',
      jobId: 'job-1',
      jobName: null,
      activeCronJobCount: null,
      totalCronJobCount: null,
    });

    expect(buildCronJobChangedReport(makeFinishedEvent(), null)).toBeNull();
    expect(
      buildCronJobChangedReport(makeFinishedEvent({ action: 'started' }), null)
    ).toBeNull();
  });

  it('builds a snapshot report from a job list', () => {
    expect(buildCronSnapshotReport([makeJob(), makeOnExitJob()])).toEqual({
      activeCronJobCount: 2,
      totalCronJobCount: 2,
      scheduleKindCronCount: 1,
      scheduleKindEveryCount: 0,
      scheduleKindAtCount: 0,
      scheduleKindOnExitCount: 1,
    });
  });
});

describe('cron telemetry hook handling', () => {
  const reports: TlonCronTelemetryReport[] = [];

  beforeEach(() => {
    reports.length = 0;
    _testing.clearCronServiceAccessor();
    setCronTelemetryReporter((report) => {
      reports.push(report);
    });
  });

  afterEach(() => {
    setCronTelemetryReporter(null);
    _testing.clearCronServiceAccessor();
    vi.useRealTimers();
  });

  function makeCronService(jobs: HookCronJob[]) {
    return {
      list: vi.fn().mockResolvedValue(jobs),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
  }

  it('reports a run for finished events', async () => {
    await handleCronChangedEvent(makeFinishedEvent(), {});
    expect(reports).toEqual([
      { kind: 'run', event: expect.objectContaining({ status: 'ok' }) },
    ]);
  });

  it('ignores started events', async () => {
    await handleCronChangedEvent(makeFinishedEvent({ action: 'started' }), {});
    expect(reports).toEqual([]);
  });

  it('reports job changes with fresh counts from the cron service', async () => {
    const service = makeCronService([makeJob(), makeJob({ id: 'job-2' })]);
    await handleCronChangedEvent(
      { action: 'added', jobId: 'job-1', job: makeJob() },
      { getCron: () => service }
    );
    expect(service.list).toHaveBeenCalledWith({ includeDisabled: true });
    expect(reports).toEqual([
      {
        kind: 'jobChanged',
        event: expect.objectContaining({
          cronAction: 'added',
          activeCronJobCount: 2,
          totalCronJobCount: 2,
        }),
      },
    ]);
  });

  it('still reports job changes when listing fails', async () => {
    const service = {
      list: vi.fn().mockRejectedValue(new Error('cron unavailable')),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    await handleCronChangedEvent(
      { action: 'removed', jobId: 'job-1' },
      { getCron: () => service }
    );
    expect(reports).toEqual([
      {
        kind: 'jobChanged',
        event: expect.objectContaining({
          cronAction: 'removed',
          activeCronJobCount: null,
          totalCronJobCount: null,
        }),
      },
    ]);
  });

  it('publishes the cron service accessor for later snapshots', async () => {
    const service = makeCronService([makeJob()]);
    await handleCronChangedEvent(makeFinishedEvent(), {
      getCron: () => service,
    });
    reports.length = 0;

    await expect(emitCronSnapshot()).resolves.toBe(true);
    expect(reports).toEqual([
      {
        kind: 'snapshot',
        event: expect.objectContaining({
          activeCronJobCount: 1,
          totalCronJobCount: 1,
        }),
      },
    ]);
  });

  it('returns false from emitCronSnapshot when no accessor is published', async () => {
    await expect(emitCronSnapshot()).resolves.toBe(false);
    expect(reports).toEqual([]);
  });

  it('clears a stopped gateway accessor before the next boot snapshot', async () => {
    const staleService = makeCronService([makeJob({ id: 'stale-job' })]);
    setCronServiceAccessor(() => staleService);
    clearCronServiceAccessor();

    await expect(emitCronSnapshot()).resolves.toBe(false);
    expect(staleService.list).not.toHaveBeenCalled();
    expect(reports).toEqual([]);
  });

  it('retries the boot snapshot once the accessor appears', async () => {
    vi.useFakeTimers();
    scheduleCronSnapshot();
    await vi.advanceTimersByTimeAsync(0);
    expect(reports).toEqual([]);

    setCronServiceAccessor(() => makeCronService([makeJob()]));
    await vi.advanceTimersByTimeAsync(_testing.getSnapshotRetryDelayMs());
    expect(reports).toEqual([
      {
        kind: 'snapshot',
        event: expect.objectContaining({ totalCronJobCount: 1 }),
      },
    ]);
  });

  it('retries after a stale accessor throws and uses its replacement', async () => {
    vi.useFakeTimers();
    const staleService = {
      ...makeCronService([]),
      list: vi.fn().mockRejectedValue(new Error('gateway stopped')),
    };
    const onError = vi.fn();
    setCronServiceAccessor(() => staleService);

    scheduleCronSnapshot({ onError });
    await vi.advanceTimersByTimeAsync(0);
    expect(staleService.list).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(reports).toEqual([]);

    setCronServiceAccessor(() => makeCronService([makeJob()]));
    await vi.advanceTimersByTimeAsync(_testing.getSnapshotRetryDelayMs());
    expect(reports).toEqual([
      {
        kind: 'snapshot',
        event: expect.objectContaining({ totalCronJobCount: 1 }),
      },
    ]);
  });
});
