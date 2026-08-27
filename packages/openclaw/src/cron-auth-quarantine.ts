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

import { sharedMap } from './shared-state.js';

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
      restored: boolean;
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

type ForwardCompatibleCronJob = PluginHookGatewayCronJob & {
  delivery?: { accountId?: string };
};

type ForwardCompatibleCronEvent = PluginHookCronChangedEvent & {
  errorReason?: string;
};

interface AuthFailureStreak {
  count: number;
  lastEventId: string | null;
}

const notifierMap = sharedMap<string, CronAuthQuarantineNotifier>(
  'cronAuthQuarantine.ownerNotifiers'
);
const activeClaims = sharedMap<string, true>('cronAuthQuarantine.activeClaims');
const authFailureStreaks = sharedMap<string, AuthFailureStreak>(
  'cronAuthQuarantine.authFailureStreaks'
);

export function setCronAuthQuarantineNotifier(
  accountId: string,
  notifier: CronAuthQuarantineNotifier
): () => void {
  notifierMap.set(accountId, notifier);
  return () => {
    // Config reloads can start a replacement monitor before the old monitor's
    // finally block runs. Only the monitor that installed this exact callback
    // may clear it; otherwise stale teardown disconnects the new notifier.
    if (notifierMap.get(accountId) === notifier) {
      notifierMap.delete(accountId);
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

function eventIdentity(event: PluginHookCronChangedEvent): string | null {
  if (event.runId?.trim()) return `run:${event.runId.trim()}`;
  if (event.sessionId?.trim()) return `session:${event.sessionId.trim()}`;
  if (typeof event.runAtMs === 'number' && Number.isFinite(event.runAtMs)) {
    return `at:${event.runAtMs}`;
  }
  return null;
}

function resetAuthenticationStreak(jobId: string): void {
  authFailureStreaks.delete(jobId);
}

function recordAuthenticationFailure(
  jobId: string,
  event: PluginHookCronChangedEvent
): number {
  const previous = authFailureStreaks.get(jobId);
  const identity = eventIdentity(event);
  if (identity && previous?.lastEventId === identity) {
    return previous.count;
  }
  const count = (previous?.count ?? 0) + 1;
  authFailureStreaks.set(jobId, { count, lastEventId: identity });
  return count;
}

function hasModelProviderContext(
  event: PluginHookCronChangedEvent,
  error: string
): boolean {
  if (event.provider?.trim() || event.model?.trim()) return true;
  return /\b(?:model provider|openrouter|openai|anthropic|claude|gemini|bedrock|ollama)\b/i.test(
    error
  );
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
  // types. Generic HTTP 401s are not enough: require model/provider context so
  // an unrelated API failure cannot disable the schedule.
  const error = event.error?.trim() ?? cronJobState(job)?.lastError?.trim();
  return Boolean(
    error &&
    hasModelProviderContext(event, error) &&
    /(?:\b401\b|unauthori[sz]ed|authentication failed|invalid api[- ]?key|user not found)/i.test(
      error
    )
  );
}

function notifierForJob(
  job: PluginHookGatewayCronJob
): CronAuthQuarantineNotifier | null {
  const accountId = (job as ForwardCompatibleCronJob).delivery?.accountId;
  if (accountId?.trim()) {
    return notifierMap.get(accountId.trim()) ?? null;
  }
  if (notifierMap.size !== 1) {
    // Current SDK cron projections omit delivery.accountId. A single active
    // account is unambiguous; multiple accounts must fail closed rather than
    // disclose a job name to the last monitor that started.
    return null;
  }
  return notifierMap.values().next().value ?? null;
}

function revision(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const updatedAtMs = (value as { updatedAtMs?: unknown }).updatedAtMs;
  return typeof updatedAtMs === 'number' && Number.isFinite(updatedAtMs)
    ? updatedAtMs
    : null;
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
  if (event.action === 'removed') {
    resetAuthenticationStreak(event.jobId);
    return { status: 'ignored', reason: 'not-finished-auth-error' };
  }
  if (event.action !== 'finished') {
    return { status: 'ignored', reason: 'not-finished-auth-error' };
  }

  const service = ctx.getCron?.();
  if (!service) {
    return { status: 'ignored', reason: 'cron-service-unavailable' };
  }
  const jobs = await service.list({ includeDisabled: true });
  const job = jobs.find((candidate) => candidate.id === event.jobId);
  if (!job) {
    resetAuthenticationStreak(event.jobId);
    return { status: 'ignored', reason: 'job-not-found' };
  }
  if (event.status !== 'error') {
    resetAuthenticationStreak(job.id);
    return { status: 'ignored', reason: 'not-finished-auth-error' };
  }
  if (job.enabled === false) {
    return { status: 'ignored', reason: 'already-disabled' };
  }
  if (!isAuthenticationFailure(event, job)) {
    resetAuthenticationStreak(job.id);
    return { status: 'ignored', reason: 'not-authentication-failure' };
  }

  const failures = recordAuthenticationFailure(job.id, event);
  if (failures < CRON_AUTH_QUARANTINE_THRESHOLD) {
    return { status: 'ignored', reason: 'below-threshold' };
  }
  const notifier = notifierForJob(job);
  if (!notifier) {
    // Do not silently disable work before the correct Tlon account can be
    // selected. A later failed run will retry once routing is unambiguous.
    return { status: 'ignored', reason: 'owner-notifier-unavailable' };
  }
  if (activeClaims.has(job.id)) {
    return { status: 'ignored', reason: 'already-processing' };
  }

  activeClaims.set(job.id, true);
  try {
    const quarantined = await service.update(job.id, { enabled: false });
    const quarantineRevision = revision(quarantined);
    const ownerNotified = await notifier(
      formatCronAuthQuarantineNotice(job, failures)
    );
    if (!ownerNotified) {
      // A silent pause would strand the owner. Restore the schedule so a later
      // run can retry the quarantine once Tlon delivery is available again.
      const current = (await service.list({ includeDisabled: true })).find(
        (candidate) => candidate.id === job.id
      );
      const canRestore =
        current?.enabled === false &&
        quarantineRevision !== null &&
        revision(current) === quarantineRevision;
      if (canRestore) {
        await service.update(job.id, { enabled: true });
      }
      return {
        status: 'notification-failed',
        jobId: job.id,
        consecutiveErrors: failures,
        restored: canRestore,
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
    authFailureStreaks.clear();
    notifierMap.clear();
  },
};
