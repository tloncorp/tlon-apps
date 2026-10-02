import { describe, expect, it, vi } from 'vitest';

import {
  type TlonCronRunFinished,
  type TlonCronRunStarted,
  createTlonCronOtelObserver,
} from './cron-observability.js';

type MetricPoint = {
  attributes: Record<string, string>;
  name: string;
  value: number;
};

type ObservableCallback = (result: {
  observe(value: number, attributes?: Record<string, string>): void;
}) => void;

function fakeMeterProvider(points: MetricPoint[]) {
  const observableCallbacks = new Map<string, ObservableCallback[]>();
  return {
    getMeter: () => ({
      createCounter: (name: string) => ({
        add: (value: number, attributes: Record<string, string>) => {
          points.push({ attributes, name, value });
        },
      }),
      createHistogram: (name: string) => ({
        record: (value: number, attributes: Record<string, string>) => {
          points.push({ attributes, name, value });
        },
      }),
      createObservableGauge: (name: string) => ({
        addCallback: (callback: ObservableCallback) => {
          const callbacks = observableCallbacks.get(name) ?? [];
          callbacks.push(callback);
          observableCallbacks.set(name, callbacks);
        },
      }),
    }),
    collect(name: string): MetricPoint[] {
      const collected: MetricPoint[] = [];
      for (const callback of observableCallbacks.get(name) ?? []) {
        callback({
          observe: (value, attributes = {}) => {
            collected.push({ attributes, name, value });
          },
        });
      }
      return collected;
    },
  };
}

const startedRun: TlonCronRunStarted = {
  agentId: 'agent-main',
  jobId: 'job-1',
  jobName: 'morning briefing',
  payloadKind: 'agentTurn',
  runAtMs: 8_500,
  runId: null,
  scheduleKind: 'cron',
  sessionId: null,
  sessionKey: null,
  sessionTargetKind: 'isolated',
};

const finishedRun: TlonCronRunFinished = {
  ...startedRun,
  cronError: null,
  delivered: true,
  deliveryError: null,
  deliveryStatus: 'delivered',
  durationMs: 2_500,
  model: 'claude-sonnet-5',
  nextRunAtMs: 20_000,
  provider: 'anthropic',
  runId: null,
  sessionId: 'session-1',
  sessionKey: 'agent:main:cron:job-1',
  status: 'ok',
};

describe('Tlon cron OTEL observer', () => {
  it('projects native lifecycle and outcome fields into bounded metrics', () => {
    const points: MetricPoint[] = [];
    const provider = fakeMeterProvider(points);
    const observer = createTlonCronOtelObserver({
      getMeterProvider: () => provider,
      logger: { info: () => undefined },
      now: () => 10_000,
    });

    observer.recordStarted(startedRun);
    observer.recordFinished(finishedRun);

    expect(points).toEqual([
      {
        name: 'tlon.cron.runs.started',
        value: 1,
        attributes: {
          payload_kind: 'agentTurn',
          schedule_kind: 'cron',
          session_target: 'isolated',
        },
      },
      {
        name: 'tlon.cron.runs.finished',
        value: 1,
        attributes: {
          delivery_status: 'delivered',
          payload_kind: 'agentTurn',
          schedule_kind: 'cron',
          session_target: 'isolated',
          status: 'ok',
        },
      },
      {
        name: 'tlon.cron.run.duration',
        value: 2.5,
        attributes: {
          delivery_status: 'delivered',
          payload_kind: 'agentTurn',
          schedule_kind: 'cron',
          session_target: 'isolated',
          status: 'ok',
        },
      },
    ]);
    expect(JSON.stringify(points)).not.toContain('job-1');
    expect(JSON.stringify(points)).not.toContain('session-1');
    expect(JSON.stringify(points)).not.toContain('agent-main');
  });

  it('tracks active runs, oldest active age, and native job inventory', () => {
    const points: MetricPoint[] = [];
    let now = 10_000;
    const provider = fakeMeterProvider(points);
    const observer = createTlonCronOtelObserver({
      getMeterProvider: () => provider,
      logger: { info: () => undefined },
      now: () => now,
    });

    observer.recordStarted(startedRun);
    observer.recordJobSnapshot({
      activeCronJobCount: 4,
      scheduleKindAtCount: 1,
      scheduleKindCronCount: 2,
      scheduleKindEveryCount: 1,
      scheduleKindOnExitCount: 1,
      scheduleKindStreamCount: 1,
      totalCronJobCount: 6,
    });

    expect(provider.collect('tlon.cron.runs.active')).toEqual([
      {
        attributes: {},
        name: 'tlon.cron.runs.active',
        value: 1,
      },
    ]);
    expect(provider.collect('tlon.cron.oldest_active.age')).toEqual([
      {
        attributes: {},
        name: 'tlon.cron.oldest_active.age',
        value: 1.5,
      },
    ]);
    expect(provider.collect('tlon.cron.jobs.active')).toEqual([
      {
        attributes: {},
        name: 'tlon.cron.jobs.active',
        value: 4,
      },
    ]);
    expect(provider.collect('tlon.cron.jobs.total')).toEqual([
      {
        attributes: {},
        name: 'tlon.cron.jobs.total',
        value: 6,
      },
    ]);
    expect(provider.collect('tlon.cron.jobs.by_schedule')).toEqual([
      {
        attributes: { schedule_kind: 'cron' },
        name: 'tlon.cron.jobs.by_schedule',
        value: 2,
      },
      {
        attributes: { schedule_kind: 'every' },
        name: 'tlon.cron.jobs.by_schedule',
        value: 1,
      },
      {
        attributes: { schedule_kind: 'at' },
        name: 'tlon.cron.jobs.by_schedule',
        value: 1,
      },
      {
        attributes: { schedule_kind: 'on-exit' },
        name: 'tlon.cron.jobs.by_schedule',
        value: 1,
      },
      {
        attributes: { schedule_kind: 'stream' },
        name: 'tlon.cron.jobs.by_schedule',
        value: 1,
      },
    ]);

    now = 12_000;
    observer.recordFinished(finishedRun);
    expect(provider.collect('tlon.cron.runs.active').at(-1)).toMatchObject({
      value: 0,
    });
    expect(
      provider.collect('tlon.cron.oldest_active.age').at(-1)
    ).toMatchObject({ value: 0 });
  });

  it('enriches isolated terminal logs with distinct agent context', () => {
    const points: MetricPoint[] = [];
    const info = vi.fn();
    const provider = fakeMeterProvider(points);
    const observer = createTlonCronOtelObserver({
      getMeterProvider: () => provider,
      logger: { info },
      now: () => 10_000,
    });

    observer.recordStarted(startedRun);
    observer.recordAgentContext({
      runId: 'agent-run-1',
      sessionId: 'session-1',
      sessionKey: 'agent:main:cron:job-1',
    });
    // The same agent context can arrive from agent_turn_prepare and
    // model_call_started. The second hook must be harmless.
    observer.recordAgentContext({
      runId: 'agent-run-1',
      sessionKey: 'agent:main:cron:job-1',
    });
    observer.recordFinished({
      ...finishedRun,
      cronError: 'model timed out',
      delivered: false,
      deliveryError: 'channel unavailable',
      deliveryStatus: 'not-delivered',
      status: 'error',
    });

    expect(info).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith(
      'tlon.cron.run.finished',
      expect.objectContaining({
        'tlon.cron.delivery_error': 'channel unavailable',
        'tlon.cron.delivery_status': 'not-delivered',
        'tlon.cron.error': 'model timed out',
        'tlon.cron.event': 'tlon.cron.run.finished',
        'tlon.cron.agent_run_id': 'agent-run-1',
        'tlon.cron.job_id': 'job-1',
        'tlon.cron.session_id': 'session-1',
        'tlon.cron.status': 'error',
      })
    );
    expect(info.mock.calls[0]?.[1]).not.toHaveProperty('traceId');
    expect(info.mock.calls[0]?.[1]).not.toHaveProperty('otelTraceId');
    expect(info.mock.calls[0]?.[1]).not.toHaveProperty('tlon.cron.run_id');
  });

  it('still records a native terminal outcome when the start was missed', () => {
    const points: MetricPoint[] = [];
    const info = vi.fn();
    const provider = fakeMeterProvider(points);
    const observer = createTlonCronOtelObserver({
      getMeterProvider: () => provider,
      logger: { info },
    });

    observer.recordFinished(finishedRun);
    expect(points.map((point) => point.name)).toEqual([
      'tlon.cron.runs.finished',
      'tlon.cron.run.duration',
    ]);
    expect(info).toHaveBeenCalledOnce();
  });

  it('replaces stale session correlation when a new agent run ID appears', () => {
    const points: MetricPoint[] = [];
    const info = vi.fn();
    const provider = fakeMeterProvider(points);
    const observer = createTlonCronOtelObserver({
      getMeterProvider: () => provider,
      logger: { info },
    });

    observer.recordStarted(startedRun);
    observer.recordAgentContext({
      runId: 'stale-run',
      sessionId: 'session-1',
      sessionKey: 'agent:main:cron:job-1',
    });
    observer.recordAgentContext({
      runId: 'current-run',
      sessionId: 'session-1',
      sessionKey: 'agent:main:cron:job-1',
    });

    observer.recordFinished({ ...finishedRun, runId: 'cron-task-run' });
    expect(info).toHaveBeenCalledWith(
      'tlon.cron.run.finished',
      expect.objectContaining({
        'tlon.cron.agent_run_id': 'current-run',
        'tlon.cron.run_id': 'cron-task-run',
      })
    );
  });

  it('keeps future job-ID correlation from conflating agent and cron run IDs', () => {
    const points: MetricPoint[] = [];
    const info = vi.fn();
    const provider = fakeMeterProvider(points);
    const observer = createTlonCronOtelObserver({
      getMeterProvider: () => provider,
      logger: { info },
    });

    observer.recordStarted(startedRun);
    observer.recordAgentContext({
      jobId: 'job-1',
      runId: 'agent-run-1',
    });
    observer.recordFinished({
      ...finishedRun,
      runId: null,
      sessionKey: null,
    });

    expect(info).toHaveBeenCalledWith(
      'tlon.cron.run.finished',
      expect.objectContaining({
        'tlon.cron.agent_run_id': 'agent-run-1',
      })
    );
    expect(info.mock.calls[0]?.[1]).not.toHaveProperty('tlon.cron.run_id');
  });

  it('does not use session-only fallback for shared main-session jobs', () => {
    const points: MetricPoint[] = [];
    const info = vi.fn();
    const provider = fakeMeterProvider(points);
    const observer = createTlonCronOtelObserver({
      getMeterProvider: () => provider,
      logger: { info },
    });

    observer.recordStarted({
      ...startedRun,
      sessionTargetKind: 'main',
    });
    observer.recordAgentContext({
      runId: 'agent-run-1',
      sessionId: 'shared-main-session',
      sessionKey: 'agent:main:main',
    });

    observer.recordFinished({
      ...finishedRun,
      sessionId: 'shared-main-session',
      sessionKey: 'agent:main:main',
      sessionTargetKind: 'main',
    });
    expect(info.mock.calls[0]?.[1]).not.toHaveProperty(
      'tlon.cron.agent_run_id'
    );
  });

  it('collapses unexpected metric dimensions', () => {
    const points: MetricPoint[] = [];
    const provider = fakeMeterProvider(points);
    const observer = createTlonCronOtelObserver({
      getMeterProvider: () => provider,
      logger: { info: () => undefined },
    });

    observer.recordStarted({
      ...startedRun,
      payloadKind: 'user-controlled-kind',
      scheduleKind: 'user-controlled-schedule',
      sessionTargetKind: 'session:user-controlled-key',
    });
    observer.recordFinished(finishedRun);

    expect(points[0]?.attributes).toEqual({
      payload_kind: 'unknown',
      schedule_kind: 'unknown',
      session_target: 'unknown',
    });
  });

  it('rebinds instruments when diagnostics replaces the meter provider', () => {
    const before: MetricPoint[] = [];
    const after: MetricPoint[] = [];
    let provider = fakeMeterProvider(before);
    const observer = createTlonCronOtelObserver({
      getMeterProvider: () => provider,
      logger: { info: () => undefined },
    });

    observer.recordStarted(startedRun);
    provider = fakeMeterProvider(after);
    observer.recordFinished(finishedRun);

    expect(before.map((point) => point.name)).toEqual([
      'tlon.cron.runs.started',
    ]);
    expect(after.map((point) => point.name)).toEqual([
      'tlon.cron.runs.finished',
      'tlon.cron.run.duration',
    ]);
    expect(provider.collect('tlon.cron.runs.active')).toHaveLength(1);
  });

  it('keeps metrics and logging failures out of cron behavior', () => {
    const brokenProvider = {
      getMeter: () => {
        throw new Error('meter unavailable');
      },
    };
    const observer = createTlonCronOtelObserver({
      getMeterProvider: () => brokenProvider,
      logger: {
        info: () => {
          throw new Error('logger unavailable');
        },
      },
    });

    expect(() => observer.recordStarted(startedRun)).not.toThrow();
    expect(() =>
      observer.recordJobSnapshot({
        activeCronJobCount: 1,
        scheduleKindAtCount: 0,
        scheduleKindCronCount: 1,
        scheduleKindEveryCount: 0,
        scheduleKindOnExitCount: 0,
        scheduleKindStreamCount: 0,
        totalCronJobCount: 1,
      })
    ).not.toThrow();
    expect(() => observer.recordFinished(finishedRun)).not.toThrow();
  });
});
