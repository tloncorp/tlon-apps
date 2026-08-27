/**
 * Stops scheduled work that cannot authenticate with its model provider.
 *
 * OpenClaw records consecutive cron failures and classifies provider errors,
 * but its failure alerts are optional and it leaves recurring jobs enabled.
 * The Tlon monitor supplies an owner-DM notifier so this gateway-global hook
 * can pause a failing schedule and give the owner an actionable recovery path.
 */
import type {
  PluginHookCronChangedEvent,
  PluginHookGatewayContext,
  PluginHookGatewayCronJob,
} from 'openclaw/plugin-sdk/types';

import { sharedMap, sharedSlot } from './shared-state.js';

export const CRON_AUTH_QUARANTINE_THRESHOLD = 3;

export type CronAuthQuarantineNotifier = (
  message: string
) => Promise<boolean> | boolean;

export type CronAuthQuarantineResult =
  | { status: 'ignored'; reason: string }
  | {
      status: 'notification-failed';
      jobId: string;
      consecutiveErrors: number;
    }
  | {
      status: 'quarantined';
      jobId: string;
      consecutiveErrors: number;
    };

type ForwardCompatibleCronJobState = NonNullable<
  PluginHookGatewayCronJob['state']
> & {
  consecutiveErrors?: number;
  lastErrorReason?: string;
};

type ForwardCompatibleCronEvent = PluginHookCronChangedEvent & {
  errorReason?: string;
};

const notifierSlot = sharedSlot<CronAuthQuarantineNotifier>(
  'cronAuthQuarantine.ownerNotifier'
);
const activeClaims = sharedMap<string, true>('cronAuthQuarantine.activeClaims');

export function setCronAuthQuarantineNotifier(
  notifier: CronAuthQuarantineNotifier
): () => void {
  notifierSlot.set(notifier);
  return () => {
    // Config reloads can start a replacement monitor before the old monitor's
    // finally block runs. Only the monitor that installed this exact callback
    // may clear it; otherwise stale teardown disconnects the new notifier.
    if (notifierSlot.get() === notifier) {
      notifierSlot.set(null);
    }
  };
}

function cronJobState(
  job: PluginHookGatewayCronJob | undefined
): ForwardCompatibleCronJobState | undefined {
  return job?.state as ForwardCompatibleCronJobState | undefined;
}

function normalizedReason(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function isAuthenticationFailure(
  event: PluginHookCronChangedEvent,
  job: PluginHookGatewayCronJob | undefined
): boolean {
  const eventReason = normalizedReason(
    (event as ForwardCompatibleCronEvent).errorReason
  );
  const jobReason = normalizedReason(cronJobState(job)?.lastErrorReason);
  if (
    eventReason === 'auth' ||
    eventReason === 'auth_permanent' ||
    jobReason === 'auth' ||
    jobReason === 'auth_permanent'
  ) {
    return true;
  }

  // Older hosts may not project the structured reason through plugin hook
  // types. Limit the fallback to well-known provider-authentication errors.
  const error = event.error?.trim() ?? cronJobState(job)?.lastError?.trim();
  return Boolean(
    error &&
    /(?:\b401\b|unauthori[sz]ed|authentication failed|invalid api[- ]?key|user not found)/i.test(
      error
    )
  );
}

function consecutiveErrors(job: PluginHookGatewayCronJob | undefined): number {
  const value = cronJobState(job)?.consecutiveErrors;
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

export function formatCronAuthQuarantineNotice(
  job: Pick<PluginHookGatewayCronJob, 'id' | 'name'>,
  failures: number
): string {
  const name = job.name?.trim() || job.id;
  return (
    `Scheduled update “${name}” was paused after ${failures} consecutive ` +
    'model-provider authentication failures. Open your bot model settings and ' +
    'reconnect or update the provider credentials, then re-enable the schedule. ' +
    'It will not run again until you re-enable it.'
  );
}

/**
 * Pause a recurring job after repeated provider-authentication failures.
 * Returns an explicit outcome so the entrypoint can log semantic failures
 * separately from best-effort telemetry.
 */
export async function handleCronAuthQuarantine(
  event: PluginHookCronChangedEvent,
  ctx: Pick<PluginHookGatewayContext, 'getCron'>
): Promise<CronAuthQuarantineResult> {
  if (event.action !== 'finished' || event.status !== 'error') {
    return { status: 'ignored', reason: 'not-finished-auth-error' };
  }

  const service = ctx.getCron?.();
  if (!service) {
    return { status: 'ignored', reason: 'cron-service-unavailable' };
  }
  const notifier = notifierSlot.get();
  if (!notifier) {
    // Do not silently disable work before the Tlon monitor is able to tell its
    // owner. A later failed run will retry once the notifier is connected.
    return { status: 'ignored', reason: 'owner-notifier-unavailable' };
  }

  const jobs = await service.list({ includeDisabled: true });
  const job = jobs.find((candidate) => candidate.id === event.jobId);
  if (!job) {
    return { status: 'ignored', reason: 'job-not-found' };
  }
  if (job.enabled === false) {
    return { status: 'ignored', reason: 'already-disabled' };
  }
  if (!isAuthenticationFailure(event, job)) {
    return { status: 'ignored', reason: 'not-authentication-failure' };
  }

  const failures = consecutiveErrors(job);
  if (failures < CRON_AUTH_QUARANTINE_THRESHOLD) {
    return { status: 'ignored', reason: 'below-threshold' };
  }
  if (activeClaims.has(job.id)) {
    return { status: 'ignored', reason: 'already-processing' };
  }

  activeClaims.set(job.id, true);
  try {
    await service.update(job.id, { enabled: false });
    const ownerNotified = await notifier(
      formatCronAuthQuarantineNotice(job, failures)
    );
    if (!ownerNotified) {
      // A silent pause would strand the owner. Restore the schedule so a later
      // run can retry the quarantine once Tlon delivery is available again.
      await service.update(job.id, { enabled: true });
      return {
        status: 'notification-failed',
        jobId: job.id,
        consecutiveErrors: failures,
      };
    }
    return {
      status: 'quarantined',
      jobId: job.id,
      consecutiveErrors: failures,
    };
  } finally {
    activeClaims.delete(job.id);
  }
}

export const _testing = {
  clear: () => {
    activeClaims.clear();
    notifierSlot.set(null);
  },
};
