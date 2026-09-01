import { metrics } from '@opentelemetry/api';
import { createSubsystemLogger } from 'openclaw/plugin-sdk/runtime-env';

export type TlonCronRunStarted = {
  agentId: string | null;
  jobId: string;
  jobName: string | null;
  payloadKind: string | null;
  runAtMs: number | null;
  runId: string | null;
  scheduleKind: string | null;
  sessionId: string | null;
  sessionKey: string | null;
  sessionTargetKind: string | null;
};

export type TlonCronRunFinished = TlonCronRunStarted & {
  cronError: string | null;
  delivered: boolean | null;
  deliveryError: string | null;
  deliveryStatus: string | null;
  durationMs: number | null;
  model: string | null;
  nextRunAtMs: number | null;
  provider: string | null;
  status: string;
};

export type TlonCronAgentContext = {
  jobId?: string;
  runId?: string;
  sessionId?: string;
  sessionKey?: string;
};

export type TlonCronJobSnapshot = {
  activeCronJobCount: number;
  scheduleKindAtCount: number;
  scheduleKindCronCount: number;
  scheduleKindEveryCount: number;
  scheduleKindOnExitCount: number;
  scheduleKindStreamCount: number;
  totalCronJobCount: number;
};

export type TlonCronOtelObserver = {
  recordAgentContext(input: TlonCronAgentContext): void;
  recordFinished(input: TlonCronRunFinished): void;
  recordJobSnapshot(snapshot: TlonCronJobSnapshot): void;
  recordStarted(input: TlonCronRunStarted): void;
  reset(): void;
};

type MetricAttributes = Record<string, string>;

type CounterLike = {
  add(value: number, attributes: MetricAttributes): void;
};

type HistogramLike = {
  record(value: number, attributes: MetricAttributes): void;
};

type ObservableResultLike = {
  observe(value: number, attributes?: MetricAttributes): void;
};

type ObservableGaugeLike = {
  addCallback(callback: (result: ObservableResultLike) => void): void;
};

type MeterProviderLike = {
  getMeter(name: string): {
    createCounter(
      name: string,
      options?: { description?: string; unit?: string }
    ): CounterLike;
    createHistogram(
      name: string,
      options?: { description?: string; unit?: string }
    ): HistogramLike;
    createObservableGauge(
      name: string,
      options?: { description?: string; unit?: string }
    ): ObservableGaugeLike;
  };
};

type CronLoggerLike = {
  info(message: string, meta?: Record<string, unknown>): void;
};

type CronInstruments = {
  active: ObservableGaugeLike;
  duration: HistogramLike;
  finished: CounterLike;
  jobsActive: ObservableGaugeLike;
  jobsBySchedule: ObservableGaugeLike;
  jobsTotal: ObservableGaugeLike;
  oldestActiveAge: ObservableGaugeLike;
  started: CounterLike;
};

type ActiveCronRun = TlonCronRunStarted & {
  agentRunId: string | null;
  startedAtMs: number;
};

type CronAgentContextRecord = {
  agentRunId: string | null;
  sessionId: string | null;
};

const MAX_CRON_AGENT_SESSIONS = 512;
const SCHEDULE_KINDS = new Set(['at', 'cron', 'every', 'on-exit', 'stream']);
const SESSION_TARGET_KINDS = new Set([
  'current',
  'isolated',
  'main',
  'session',
]);
const PAYLOAD_KINDS = new Set(['agentTurn', 'command', 'systemEvent']);
const RUN_STATUSES = new Set(['error', 'ok', 'skipped']);
const DELIVERY_STATUSES = new Set([
  'delivered',
  'not-delivered',
  'not-requested',
  'unknown',
]);
const terminalLogger = createSubsystemLogger('tlon/cron');

function safeObserve(run: () => void): void {
  try {
    run();
  } catch {
    // Observability must never alter cron execution or delivery behavior.
  }
}

function optionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function boundedDimension(
  value: string | null | undefined,
  allowed: Set<string>
): string {
  const normalized = optionalString(value);
  return normalized && allowed.has(normalized) ? normalized : 'unknown';
}

function baseMetricAttributes(input: TlonCronRunStarted): MetricAttributes {
  return {
    payload_kind: boundedDimension(input.payloadKind, PAYLOAD_KINDS),
    schedule_kind: boundedDimension(input.scheduleKind, SCHEDULE_KINDS),
    session_target: boundedDimension(
      input.sessionTargetKind,
      SESSION_TARGET_KINDS
    ),
  };
}

function terminalMetricAttributes(
  input: TlonCronRunFinished
): MetricAttributes {
  return {
    ...baseMetricAttributes(input),
    delivery_status: boundedDimension(input.deliveryStatus, DELIVERY_STATUSES),
    status: boundedDimension(input.status, RUN_STATUSES),
  };
}

function mergeRun(
  finished: TlonCronRunFinished,
  active: ActiveCronRun | undefined
): TlonCronRunFinished {
  if (!active) {
    return finished;
  }
  return {
    ...finished,
    agentId: finished.agentId ?? active.agentId,
    jobName: finished.jobName ?? active.jobName,
    payloadKind: finished.payloadKind ?? active.payloadKind,
    runAtMs: finished.runAtMs ?? active.runAtMs,
    runId: finished.runId ?? active.runId,
    scheduleKind: finished.scheduleKind ?? active.scheduleKind,
    sessionId: finished.sessionId ?? active.sessionId,
    sessionKey: finished.sessionKey ?? active.sessionKey,
    sessionTargetKind: finished.sessionTargetKind ?? active.sessionTargetKind,
  };
}

function optionalLogField(
  key: string,
  value: string | number | boolean | null | undefined
): Record<string, unknown> {
  return value === null || value === undefined ? {} : { [key]: value };
}

export function createTlonCronOtelObserver(options?: {
  getMeterProvider?: () => MeterProviderLike;
  logger?: CronLoggerLike;
  now?: () => number;
}): TlonCronOtelObserver {
  const getMeterProvider =
    options?.getMeterProvider ??
    (() => metrics.getMeterProvider() as MeterProviderLike);
  const logger = options?.logger ?? terminalLogger;
  const now = options?.now ?? Date.now;
  const activeRuns = new Map<string, ActiveCronRun>();
  const agentContextsBySessionKey = new Map<string, CronAgentContextRecord>();
  const instrumentsByProvider = new WeakMap<object, CronInstruments>();
  let jobSnapshot: TlonCronJobSnapshot | null = null;

  const rememberAgentContext = (input: TlonCronAgentContext): void => {
    const sessionKey = optionalString(input.sessionKey);
    if (!sessionKey) {
      return;
    }
    const runId = optionalString(input.runId);
    const sessionId = optionalString(input.sessionId);
    const existing = agentContextsBySessionKey.get(sessionKey);
    const sameRun =
      existing !== undefined && runId !== null && runId === existing.agentRunId;
    agentContextsBySessionKey.set(sessionKey, {
      agentRunId: runId,
      sessionId: sessionId ?? (sameRun ? existing.sessionId : null),
    });
    while (agentContextsBySessionKey.size > MAX_CRON_AGENT_SESSIONS) {
      const oldestSessionKey = agentContextsBySessionKey.keys().next().value;
      if (oldestSessionKey === undefined) {
        break;
      }
      agentContextsBySessionKey.delete(oldestSessionKey);
    }
  };

  const takeAgentContext = (
    run: TlonCronRunFinished
  ): CronAgentContextRecord | null => {
    if (run.sessionTargetKind !== 'isolated') {
      return null;
    }
    const sessionKey = optionalString(run.sessionKey);
    const sessionId = optionalString(run.sessionId);
    if (!sessionKey) {
      return null;
    }
    const record = agentContextsBySessionKey.get(sessionKey);
    if (!record) {
      return null;
    }
    agentContextsBySessionKey.delete(sessionKey);
    if (!sessionId || !record.sessionId || record.sessionId !== sessionId) {
      return null;
    }
    return record;
  };

  const registerObservableCallbacks = (instruments: CronInstruments): void => {
    instruments.active.addCallback((result) => {
      safeObserve(() => result.observe(activeRuns.size));
    });
    instruments.oldestActiveAge.addCallback((result) => {
      safeObserve(() => {
        let oldestStartedAtMs: number | null = null;
        for (const run of activeRuns.values()) {
          oldestStartedAtMs =
            oldestStartedAtMs === null
              ? run.startedAtMs
              : Math.min(oldestStartedAtMs, run.startedAtMs);
        }
        const ageSeconds =
          oldestStartedAtMs === null
            ? 0
            : Math.max(0, now() - oldestStartedAtMs) / 1000;
        result.observe(ageSeconds);
      });
    });
    instruments.jobsActive.addCallback((result) => {
      safeObserve(() => {
        if (jobSnapshot) {
          result.observe(jobSnapshot.activeCronJobCount);
        }
      });
    });
    instruments.jobsTotal.addCallback((result) => {
      safeObserve(() => {
        if (jobSnapshot) {
          result.observe(jobSnapshot.totalCronJobCount);
        }
      });
    });
    instruments.jobsBySchedule.addCallback((result) => {
      safeObserve(() => {
        if (!jobSnapshot) {
          return;
        }
        result.observe(jobSnapshot.scheduleKindCronCount, {
          schedule_kind: 'cron',
        });
        result.observe(jobSnapshot.scheduleKindEveryCount, {
          schedule_kind: 'every',
        });
        result.observe(jobSnapshot.scheduleKindAtCount, {
          schedule_kind: 'at',
        });
        result.observe(jobSnapshot.scheduleKindOnExitCount, {
          schedule_kind: 'on-exit',
        });
        result.observe(jobSnapshot.scheduleKindStreamCount, {
          schedule_kind: 'stream',
        });
      });
    });
  };

  const getInstruments = (): CronInstruments => {
    const provider = getMeterProvider();
    const existing = instrumentsByProvider.get(provider);
    if (existing) {
      return existing;
    }
    const meter = provider.getMeter('tlon.openclaw');
    const instruments: CronInstruments = {
      started: meter.createCounter('tlon.cron.runs.started', {
        description: 'OpenClaw cron runs started',
        unit: '1',
      }),
      finished: meter.createCounter('tlon.cron.runs.finished', {
        description: 'OpenClaw cron runs finished by native outcome',
        unit: '1',
      }),
      duration: meter.createHistogram('tlon.cron.run.duration', {
        description: 'OpenClaw cron run duration',
        unit: 's',
      }),
      active: meter.createObservableGauge('tlon.cron.runs.active', {
        description: 'OpenClaw cron runs currently active',
        unit: '1',
      }),
      oldestActiveAge: meter.createObservableGauge(
        'tlon.cron.oldest_active.age',
        {
          description: 'Age of the oldest active OpenClaw cron run',
          unit: 's',
        }
      ),
      jobsActive: meter.createObservableGauge('tlon.cron.jobs.active', {
        description: 'Enabled OpenClaw cron jobs',
        unit: '1',
      }),
      jobsTotal: meter.createObservableGauge('tlon.cron.jobs.total', {
        description: 'Configured OpenClaw cron jobs',
        unit: '1',
      }),
      jobsBySchedule: meter.createObservableGauge(
        'tlon.cron.jobs.by_schedule',
        {
          description: 'Configured OpenClaw cron jobs by schedule kind',
          unit: '1',
        }
      ),
    };
    instrumentsByProvider.set(provider, instruments);
    registerObservableCallbacks(instruments);
    return instruments;
  };

  return {
    recordStarted(input) {
      const runAtMs = finiteNumber(input.runAtMs);
      activeRuns.set(input.jobId, {
        ...input,
        agentRunId: null,
        startedAtMs: runAtMs ?? now(),
      });
      safeObserve(() => {
        getInstruments().started.add(1, baseMetricAttributes(input));
      });
    },
    recordAgentContext(input) {
      rememberAgentContext(input);
      const jobId = optionalString(input.jobId);
      if (!jobId) {
        return;
      }
      const active = activeRuns.get(jobId);
      if (!active) {
        return;
      }
      activeRuns.set(jobId, {
        ...active,
        agentRunId: optionalString(input.runId) ?? active.agentRunId,
        sessionId: optionalString(input.sessionId) ?? active.sessionId,
        sessionKey: optionalString(input.sessionKey) ?? active.sessionKey,
      });
    },
    recordFinished(input) {
      const active = activeRuns.get(input.jobId);
      activeRuns.delete(input.jobId);
      const mergedRun = mergeRun(input, active);
      // Prefer exact job correlation when future OpenClaw versions populate
      // jobId on the agent hook. The isolated-only session context is still
      // consumed so it cannot become stale.
      const sessionAgentContext = takeAgentContext(mergedRun);
      const agentContext = active?.agentRunId ? null : sessionAgentContext;
      const run = {
        ...mergedRun,
        sessionId: mergedRun.sessionId ?? agentContext?.sessionId ?? null,
      };
      const agentRunId = active?.agentRunId ?? agentContext?.agentRunId ?? null;
      const attributes = terminalMetricAttributes(run);
      safeObserve(() => {
        const instruments = getInstruments();
        instruments.finished.add(1, attributes);
        const durationMs = finiteNumber(run.durationMs);
        if (durationMs !== null) {
          instruments.duration.record(
            Math.max(0, durationMs) / 1000,
            attributes
          );
        }
      });

      safeObserve(() => {
        logger.info('tlon.cron.run.finished', {
          'tlon.cron.event': 'tlon.cron.run.finished',
          'tlon.cron.job_id': run.jobId,
          'tlon.cron.status': run.status,
          ...optionalLogField('tlon.cron.agent_id', run.agentId),
          ...optionalLogField('tlon.cron.agent_run_id', agentRunId),
          ...optionalLogField('tlon.cron.job_name', run.jobName),
          ...optionalLogField('tlon.cron.run_id', run.runId),
          ...optionalLogField('tlon.cron.session_id', run.sessionId),
          ...optionalLogField('tlon.cron.session_key', run.sessionKey),
          ...optionalLogField('tlon.cron.run_at_ms', run.runAtMs),
          ...optionalLogField('tlon.cron.duration_ms', run.durationMs),
          ...optionalLogField('tlon.cron.next_run_at_ms', run.nextRunAtMs),
          ...optionalLogField('tlon.cron.error', run.cronError),
          ...optionalLogField('tlon.cron.delivered', run.delivered),
          ...optionalLogField('tlon.cron.delivery_status', run.deliveryStatus),
          ...optionalLogField('tlon.cron.delivery_error', run.deliveryError),
          ...optionalLogField('tlon.cron.model', run.model),
          ...optionalLogField('tlon.cron.provider', run.provider),
          ...optionalLogField('tlon.cron.payload_kind', run.payloadKind),
          ...optionalLogField('tlon.cron.schedule_kind', run.scheduleKind),
          ...optionalLogField(
            'tlon.cron.session_target',
            run.sessionTargetKind
          ),
        });
      });
    },
    recordJobSnapshot(snapshot) {
      jobSnapshot = snapshot;
      safeObserve(() => {
        getInstruments();
      });
    },
    reset() {
      activeRuns.clear();
      agentContextsBySessionKey.clear();
      jobSnapshot = null;
    },
  };
}

const defaultCronObserver = createTlonCronOtelObserver();

export function recordTlonCronAgentContext(input: TlonCronAgentContext): void {
  safeObserve(() => defaultCronObserver.recordAgentContext(input));
}

export function resetTlonCronObservability(): void {
  safeObserve(() => defaultCronObserver.reset());
}

export function getDefaultTlonCronOtelObserver(): TlonCronOtelObserver {
  return defaultCronObserver;
}
