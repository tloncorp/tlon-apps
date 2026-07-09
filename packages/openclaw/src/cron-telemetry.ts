/**
 * Cron observability: translates the gateway-global `cron_changed` hook into
 * Tlon telemetry events.
 *
 * The hook fires for every cron lifecycle change (`added`/`updated`/`removed`)
 * and every run (`started`/`finished`). We emit:
 * - `TlonBot Cron Job Changed` for lifecycle changes, with fresh job counts
 *   from `ctx.getCron().list()`.
 * - `TlonBot Cron Run` for `finished` events (success/failure/skip, duration,
 *   delivery outcome). `started` is intentionally ignored — the gateway
 *   enforces run timeouts, so every start produces a `finished`.
 * - `TlonBot Cron Snapshot` once per boot (from the monitor, after connect),
 *   reconciling counts that drift when change events are missed.
 *
 * Privacy: job snapshots carry the literal prompt (`payload.text`) and run
 * results carry agent output (`summary`). Neither is ever forwarded — only
 * schedule metadata, status, and error text (truncated) leave the process.
 */
import type {
  PluginHookCronChangedEvent,
  PluginHookGatewayContext,
  PluginHookGatewayCronJob,
  PluginHookGatewayCronService,
} from 'openclaw/plugin-sdk/types';

import { sharedSlot } from './shared-state.js';
import {
  type TlonCronCountFields,
  type TlonCronJobChangedReportInput,
  type TlonCronRunReportInput,
  type TlonCronScheduleFields,
  type TlonCronSnapshotReportInput,
  reportCronJobChanged,
  reportCronRun,
  reportCronSnapshot,
} from './telemetry.js';

const CRON_ERROR_MAX_CHARS = 500;
const SNAPSHOT_RETRY_DELAY_MS = 20_000;

type CronServiceAccessor = () => PluginHookGatewayCronService | undefined;

/**
 * The cron service is only reachable through gateway hook contexts
 * (`gateway_start`, `cron_changed`), but the boot snapshot is emitted from the
 * monitor, which has no hook context. Hook handlers stash the accessor here.
 */
const cronServiceAccessorSlot = sharedSlot<CronServiceAccessor>(
  'cronTelemetry.serviceAccessor'
);

export function setCronServiceAccessor(
  accessor: CronServiceAccessor | null
): void {
  cronServiceAccessorSlot.set(accessor);
}

function optionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function optionalNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function truncateCronError(
  error: string | null | undefined
): string | null {
  const normalized = optionalString(error);
  if (!normalized) {
    return null;
  }
  return normalized.length > CRON_ERROR_MAX_CHARS
    ? `${normalized.slice(0, CRON_ERROR_MAX_CHARS)}…`
    : normalized;
}

/**
 * Session targets can be `session:<key>`; the key itself is not telemetry
 * material, so collapse to the target kind only.
 */
export function normalizeCronSessionTargetKind(
  sessionTarget: string | null | undefined
): string | null {
  const normalized = optionalString(sessionTarget);
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith('session:')) {
    return 'session';
  }
  if (
    normalized === 'main' ||
    normalized === 'isolated' ||
    normalized === 'current'
  ) {
    return normalized;
  }
  return 'unknown';
}

export function cronScheduleFields(
  job: PluginHookGatewayCronJob | undefined
): TlonCronScheduleFields {
  const empty: TlonCronScheduleFields = {
    scheduleKind: null,
    scheduleExpr: null,
    scheduleTz: null,
    scheduleEveryMs: null,
    scheduleAt: null,
  };
  const schedule = job?.schedule;
  if (!schedule) {
    return empty;
  }
  switch (schedule.kind) {
    case 'cron':
      return {
        ...empty,
        scheduleKind: 'cron',
        scheduleExpr: optionalString(schedule.expr),
        scheduleTz: optionalString(schedule.tz),
      };
    case 'every':
      return {
        ...empty,
        scheduleKind: 'every',
        scheduleEveryMs: optionalNumber(schedule.everyMs),
      };
    case 'at':
      return {
        ...empty,
        scheduleKind: 'at',
        scheduleAt: optionalString(schedule.at),
      };
    default:
      return empty;
  }
}

export function summarizeCronJobs(jobs: PluginHookGatewayCronJob[]): {
  activeCronJobCount: number;
  totalCronJobCount: number;
  scheduleKindCronCount: number;
  scheduleKindEveryCount: number;
  scheduleKindAtCount: number;
} {
  let active = 0;
  let cronKind = 0;
  let everyKind = 0;
  let atKind = 0;
  for (const job of jobs) {
    // `enabled` is optional on the hook projection; jobs default to enabled.
    if (job.enabled !== false) {
      active += 1;
    }
    switch (job.schedule?.kind) {
      case 'cron':
        cronKind += 1;
        break;
      case 'every':
        everyKind += 1;
        break;
      case 'at':
        atKind += 1;
        break;
    }
  }
  return {
    activeCronJobCount: active,
    totalCronJobCount: jobs.length,
    scheduleKindCronCount: cronKind,
    scheduleKindEveryCount: everyKind,
    scheduleKindAtCount: atKind,
  };
}

export function buildCronJobChangedReport(
  event: PluginHookCronChangedEvent,
  counts: TlonCronCountFields | null
): TlonCronJobChangedReportInput | null {
  if (
    event.action !== 'added' &&
    event.action !== 'updated' &&
    event.action !== 'removed'
  ) {
    return null;
  }
  const job = event.job;
  return {
    cronAction: event.action,
    jobId: event.jobId,
    jobName: optionalString(job?.name),
    agentId: optionalString(event.agentId ?? job?.agentId),
    enabled: typeof job?.enabled === 'boolean' ? job.enabled : null,
    wakeMode: optionalString(job?.wakeMode),
    payloadKind: optionalString(job?.payload?.kind),
    sessionTargetKind: normalizeCronSessionTargetKind(
      event.sessionTarget ?? job?.sessionTarget
    ),
    ...cronScheduleFields(job),
    activeCronJobCount: counts?.activeCronJobCount ?? null,
    totalCronJobCount: counts?.totalCronJobCount ?? null,
  };
}

export function buildCronRunReport(
  event: PluginHookCronChangedEvent
): TlonCronRunReportInput | null {
  if (event.action !== 'finished') {
    return null;
  }
  const job = event.job;
  return {
    jobId: event.jobId,
    jobName: optionalString(job?.name),
    agentId: optionalString(event.agentId ?? job?.agentId),
    runId: optionalString(event.runId),
    status: optionalString(event.status) ?? 'unknown',
    cronError: truncateCronError(event.error),
    durationMs: optionalNumber(event.durationMs),
    runAtMs: optionalNumber(event.runAtMs),
    nextRunAtMs: optionalNumber(event.nextRunAtMs),
    delivered: typeof event.delivered === 'boolean' ? event.delivered : null,
    deliveryStatus: optionalString(event.deliveryStatus),
    deliveryError: truncateCronError(event.deliveryError),
    model: optionalString(event.model),
    provider: optionalString(event.provider),
    payloadKind: optionalString(job?.payload?.kind),
    sessionTargetKind: normalizeCronSessionTargetKind(
      event.sessionTarget ?? job?.sessionTarget
    ),
    ...cronScheduleFields(job),
  };
}

export function buildCronSnapshotReport(
  jobs: PluginHookGatewayCronJob[]
): TlonCronSnapshotReportInput {
  return summarizeCronJobs(jobs);
}

async function listCronJobs(
  getCron?: CronServiceAccessor
): Promise<PluginHookGatewayCronJob[] | null> {
  const accessor = getCron ?? cronServiceAccessorSlot.get();
  const service = accessor?.();
  if (!service) {
    return null;
  }
  return await service.list({ includeDisabled: true });
}

export async function handleCronChangedEvent(
  event: PluginHookCronChangedEvent,
  ctx: Pick<PluginHookGatewayContext, 'getCron'>
): Promise<void> {
  if (ctx.getCron) {
    setCronServiceAccessor(ctx.getCron);
  }

  if (event.action === 'finished') {
    const run = buildCronRunReport(event);
    if (run) {
      reportCronRun(run);
    }
    return;
  }
  if (event.action === 'started') {
    return;
  }

  let counts: TlonCronCountFields | null = null;
  try {
    const jobs = await listCronJobs(ctx.getCron);
    counts = jobs ? summarizeCronJobs(jobs) : null;
  } catch {
    // Counts are best-effort enrichment; still emit the change event.
  }
  const report = buildCronJobChangedReport(event, counts);
  if (report) {
    reportCronJobChanged(report);
  }
}

/** @returns false when the cron service accessor is not published yet. */
export async function emitCronSnapshot(): Promise<boolean> {
  const jobs = await listCronJobs();
  if (!jobs) {
    return false;
  }
  reportCronSnapshot(buildCronSnapshotReport(jobs));
  return true;
}

/**
 * Emit the boot snapshot, retrying once: the monitor connects concurrently
 * with the `gateway_start` hook that publishes the cron service accessor, so
 * the first attempt can race it.
 */
export function scheduleCronSnapshot(opts?: {
  onError?: (error: unknown) => void;
}): void {
  const attempt = (retriesLeft: number) => {
    emitCronSnapshot()
      .then((emitted) => {
        if (!emitted && retriesLeft > 0) {
          const timer = setTimeout(
            () => attempt(retriesLeft - 1),
            SNAPSHOT_RETRY_DELAY_MS
          );
          timer.unref?.();
        }
      })
      .catch((error) => opts?.onError?.(error));
  };
  attempt(1);
}

export const _testing = {
  clearCronServiceAccessor: () => cronServiceAccessorSlot.set(null),
  getSnapshotRetryDelayMs: () => SNAPSHOT_RETRY_DELAY_MS,
};
