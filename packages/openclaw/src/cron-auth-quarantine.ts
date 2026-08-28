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
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
  if (typeof event.runAtMs === 'number' && Number.isFinite(event.runAtMs)) {
    return `at:${event.runAtMs}`;
  }
  if (event.sessionId?.trim()) return `session:${event.sessionId.trim()}`;
  return null;
}

function streakStorePath(workspaceDir: string): string {
  return path.join(workspaceDir, '.openclaw', 'tlon-cron-auth-streaks.json');
}

async function readPersistedStreaks(
  workspaceDir: string
): Promise<Record<string, AuthFailureStreak>> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(streakStorePath(workspaceDir), 'utf8')
    );
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid persisted cron authentication streak store');
    }
    const valid: Record<string, AuthFailureStreak> = {};
    for (const [jobId, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue;
      const record = value as { count?: unknown; lastEventId?: unknown };
      if (
        typeof record.count === 'number' &&
        Number.isInteger(record.count) &&
        record.count > 0 &&
        (record.lastEventId === null || typeof record.lastEventId === 'string')
      ) {
        valid[jobId] = {
          count: record.count,
          lastEventId: record.lastEventId,
        };
      }
    }
    return valid;
  } catch (error) {
    if ((error as { code?: unknown }).code === 'ENOENT') return {};
    throw error;
  }
}

async function writePersistedStreaks(
  workspaceDir: string,
  streaks: Record<string, AuthFailureStreak>
): Promise<void> {
  const target = streakStorePath(workspaceDir);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(streaks)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporary, target);
}

let persistedMutation = Promise.resolve();

async function mutatePersistedStreaks<T>(
  workspaceDir: string,
  mutate: (streaks: Record<string, AuthFailureStreak>) => T
): Promise<T> {
  let result!: T;
  const operation = persistedMutation.then(async () => {
    const streaks = await readPersistedStreaks(workspaceDir);
    result = mutate(streaks);
    await writePersistedStreaks(workspaceDir, streaks);
  });
  persistedMutation = operation.catch(() => undefined);
  await operation;
  return result;
}

async function resetAuthenticationStreak(
  jobId: string,
  workspaceDir?: string
): Promise<void> {
  authFailureStreaks.delete(jobId);
  if (workspaceDir) {
    await mutatePersistedStreaks(workspaceDir, (streaks) => {
      delete streaks[jobId];
    });
  }
}

async function recordAuthenticationFailure(
  jobId: string,
  event: PluginHookCronChangedEvent,
  workspaceDir?: string
): Promise<number> {
  const identity = eventIdentity(event);
  if (workspaceDir) {
    const next = await mutatePersistedStreaks(workspaceDir, (streaks) => {
      const previous = streaks[jobId];
      if (identity && previous?.lastEventId === identity) return previous;
      const value = {
        count: (previous?.count ?? 0) + 1,
        lastEventId: identity,
      };
      streaks[jobId] = value;
      return value;
    });
    authFailureStreaks.set(jobId, next);
    return next.count;
  }
  const previous = authFailureStreaks.get(jobId);
  if (identity && previous?.lastEventId === identity) return previous.count;
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
  if (eventReason) {
    return eventReason === 'auth' || eventReason === 'auth_permanent';
  }
  if (jobReason) {
    return jobReason === 'auth' || jobReason === 'auth_permanent';
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
  ctx: Pick<PluginHookGatewayContext, 'getCron' | 'workspaceDir'>
): Promise<CronAuthQuarantineResult> {
  if (event.action === 'removed') {
    await resetAuthenticationStreak(event.jobId, ctx.workspaceDir);
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
    await resetAuthenticationStreak(event.jobId, ctx.workspaceDir);
    return { status: 'ignored', reason: 'job-not-found' };
  }
  if (event.status !== 'error') {
    await resetAuthenticationStreak(job.id, ctx.workspaceDir);
    return { status: 'ignored', reason: 'not-finished-auth-error' };
  }
  if (job.enabled === false) {
    return { status: 'ignored', reason: 'already-disabled' };
  }
  if (!isAuthenticationFailure(event, job)) {
    await resetAuthenticationStreak(job.id, ctx.workspaceDir);
    return { status: 'ignored', reason: 'not-authentication-failure' };
  }

  const failures = await recordAuthenticationFailure(
    job.id,
    event,
    ctx.workspaceDir
  );
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
    await service.update(job.id, { enabled: false });
    const ownerNotified = await notifier(
      formatCronAuthQuarantineNotice(job, failures)
    );
    if (!ownerNotified) {
      // The cron service does not expose compare-and-swap updates. Never
      // perform a read/check/write rollback that could overwrite an owner's
      // concurrent edit; leave the failed job safely paused instead.
      return {
        status: 'notification-failed',
        jobId: job.id,
        consecutiveErrors: failures,
        restored: false,
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
  clearMemoryOnly: () => {
    activeClaims.clear();
    authFailureStreaks.clear();
  },
};
