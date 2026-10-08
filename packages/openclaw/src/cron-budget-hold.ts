import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * The fields of a gateway cron job this module reads. OpenClaw 2026.9.x does
 * not export its hook cron-job type from a public SDK subpath, so this is a
 * structural subset that both the hook context's cron service and the local
 * `TlonCronService` satisfy.
 */
export type BudgetCronJob = {
  id: string;
  description?: string;
  enabled?: boolean;
  schedule?: { kind?: string };
  state?: {
    runningAtMs?: number;
    lastRunAtMs?: number;
    lastDurationMs?: number;
  };
  updatedAtMs?: number;
};

export const BUDGET_SIGNAL_ENV = 'TLON_CRON_BUDGET_FILE';
export const BUDGET_STARTUP_ENV = 'TLON_CRON_BUDGET_STARTUP';
export function budgetHoldPaths(env = process.env) {
  const signal = env[BUDGET_SIGNAL_ENV];
  const stateDir = env.OPENCLAW_STATE_DIR;
  return signal && stateDir
    ? { signal, state: `${stateDir}/tlon-cron-budget-holds.json` }
    : null;
}

export const BUDGET_HOLD_PREFIX = '[Paused: credit budget] ';
export type BudgetState = 'limited' | 'available' | 'unknown';
export type BudgetCronService = {
  list: (opts: { includeDisabled: true }) => Promise<BudgetCronJob[]>;
  update: (
    id: string,
    patch: { enabled?: boolean; description?: string }
  ) => Promise<unknown>;
};

type Hold = {
  description: string;
  // A missing revision is a write-ahead intent, recovered after a crash.
  revision?: number;
  // Completion of a run already in flight advances updatedAtMs without an edit.
  runningAtMs?: number;
};
export type BudgetHoldChange = {
  eventId: string;
  occurredAtMs: number;
  episodeId: string | null;
  jobId: string;
  action: 'paused' | 'resumed';
  reason: 'credit_budget' | 'credit_recovered';
  source: 'startup' | 'runtime';
};

export type BudgetHoldState = {
  version: 1;
  limited: boolean;
  notified: boolean;
  episodeId?: string;
  notifiedRecipients?: string[];
  notificationAttempts?: number;
  nextNotificationAtMs?: number;
  holds: Record<string, Hold>;
  // Startup runs before telemetry exists. Drain confirmed changes in the gateway.
  pendingTelemetryChanges?: BudgetHoldChange[];
};

export const emptyBudgetHoldState = (): BudgetHoldState => ({
  version: 1,
  limited: false,
  notified: false,
  holds: {},
});

export function isRecurringJob(job: BudgetCronJob): boolean {
  return job.schedule?.kind === 'cron' || job.schedule?.kind === 'every';
}

export async function readBudgetSignal(path: string): Promise<BudgetState> {
  // The wrapper supplies a fresh observation if publication failed at startup.
  // Ignore that specific stale file until a later successful publication gives
  // it a new revision. Both preflight and the live gateway use this handoff.
  let startup:
    | { state: 'limited' | 'unknown'; staleRevision: string | null }
    | undefined;
  try {
    const value = JSON.parse(process.env[BUDGET_STARTUP_ENV] ?? 'null');
    if (
      value &&
      (value.state === 'limited' || value.state === 'unknown') &&
      (value.staleRevision === null || typeof value.staleRevision === 'string')
    ) {
      startup = value;
    }
  } catch {
    /* Invalid optional startup context cannot grant recovery. */
  }
  try {
    const data = JSON.parse(await readFile(path, 'utf8'));
    const revision = typeof data.revision === 'string' ? data.revision : null;
    if (startup) {
      const valid =
        data.version === 1 &&
        ['limited', 'available', 'unknown'].includes(data.state);
      if (!valid || revision === null || revision === startup.staleRevision)
        return startup.state;
      // Retire the process-wide handoff once a fresh publication supersedes it.
      // Later read failures must be unknown, never resurrect an old limit.
      delete process.env[BUDGET_STARTUP_ENV];
    }
    return data.version === 1 &&
      (data.state === 'limited' || data.state === 'available')
      ? data.state
      : 'unknown';
  } catch {
    // Probe/file failures cannot release an existing hold.
    return startup?.state ?? 'unknown';
  }
}

export async function readBudgetHoldState(
  path: string
): Promise<BudgetHoldState> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return emptyBudgetHoldState();
    throw error;
  }
  const data = JSON.parse(raw);
  if (
    data.version !== 1 ||
    typeof data.limited !== 'boolean' ||
    typeof data.notified !== 'boolean' ||
    (data.episodeId !== undefined && typeof data.episodeId !== 'string') ||
    (data.notifiedRecipients !== undefined &&
      (!Array.isArray(data.notifiedRecipients) ||
        data.notifiedRecipients.some(
          (id: unknown) => typeof id !== 'string'
        ))) ||
    (data.notificationAttempts !== undefined &&
      (!Number.isSafeInteger(data.notificationAttempts) ||
        data.notificationAttempts < 0)) ||
    (data.nextNotificationAtMs !== undefined &&
      !Number.isFinite(data.nextNotificationAtMs)) ||
    (data.pendingTelemetryChanges !== undefined &&
      (!Array.isArray(data.pendingTelemetryChanges) ||
        data.pendingTelemetryChanges.some(
          (event: BudgetHoldChange) =>
            !event ||
            typeof event.eventId !== 'string' ||
            !Number.isFinite(event.occurredAtMs) ||
            (event.episodeId !== null && typeof event.episodeId !== 'string') ||
            typeof event.jobId !== 'string' ||
            !['paused', 'resumed'].includes(event.action) ||
            !['credit_budget', 'credit_recovered'].includes(event.reason) ||
            !['startup', 'runtime'].includes(event.source)
        ))) ||
    !data.holds ||
    Array.isArray(data.holds) ||
    typeof data.holds !== 'object' ||
    Object.values(data.holds).some((hold) => {
      const h = hold as Hold;
      return (
        !h ||
        typeof h.description !== 'string' ||
        (h.revision !== undefined && !Number.isFinite(h.revision)) ||
        (h.runningAtMs !== undefined && !Number.isFinite(h.runningAtMs))
      );
    })
  ) {
    throw new Error('Invalid cron budget hold state');
  }
  return data as BudgetHoldState;
}

export async function writeBudgetHoldState(
  path: string,
  state: BudgetHoldState
): Promise<void> {
  await writeBudgetStateFile(path, state);
}

export async function writeBudgetStateFile(
  path: string,
  value: unknown
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value) + '\n', { mode: 0o600 });
  await rename(temporary, path);
}

/** Serialized by the caller. Uses only public cron APIs; never changes schedules. */
export async function reconcileBudgetHolds(opts: {
  budget: BudgetState;
  state: BudgetHoldState;
  cron: BudgetCronService;
  save: () => Promise<void>;
  notify?: (message: string) => Promise<boolean>;
  // Before gateway startup we only apply holds. Core's live update API must
  // release them so it computes a future next-run time without a catch-up run.
  pauseOnly?: boolean;
  externallyEditedJobs?: ReadonlySet<string>;
  now?: () => number;
}): Promise<void> {
  const { state, cron, save } = opts;
  const recordChange = (jobId: string, action: BudgetHoldChange['action']) => {
    (state.pendingTelemetryChanges ??= []).push({
      eventId: randomUUID(),
      occurredAtMs: (opts.now ?? Date.now)(),
      episodeId: state.episodeId ?? null,
      jobId,
      action,
      reason: action === 'paused' ? 'credit_budget' : 'credit_recovered',
      source: opts.pauseOnly ? 'startup' : 'runtime',
    });
  };
  if (opts.budget === 'limited' && !state.limited) {
    state.limited = true;
    state.notified = false;
    delete state.notifiedRecipients;
    delete state.notificationAttempts;
    delete state.nextNotificationAtMs;
    state.episodeId = randomUUID();
    await save();
  }
  const limited =
    opts.budget === 'unknown' ? state.limited : opts.budget === 'limited';
  if (limited && !state.episodeId) {
    state.episodeId = randomUUID();
    await save();
  }
  if (!limited && opts.pauseOnly) return;
  if (!limited && !Object.keys(state.holds).length && !state.limited) return;

  const jobs = await cron.list({ includeDisabled: true });
  const ids = new Set(jobs.map((job) => job.id));
  let removed = false;
  for (const id of Object.keys(state.holds)) {
    if (!ids.has(id)) {
      delete state.holds[id];
      removed = true;
    }
  }
  if (removed) await save();

  for (const job of jobs) {
    let hold: Hold | undefined = state.holds[job.id];
    if (hold) {
      const description = (BUDGET_HOLD_PREFIX + hold.description).trimEnd();
      const finishedHeldRun =
        hold.runningAtMs !== undefined &&
        job.state?.runningAtMs === undefined &&
        job.state?.lastRunAtMs === hold.runningAtMs &&
        typeof job.state.lastDurationMs === 'number' &&
        // Core stamps updatedAtMs with the completion time. A later edit has
        // a different revision even while lastRunAtMs still names this run.
        job.updatedAtMs === hold.runningAtMs + job.state.lastDurationMs;
      const stillOurs =
        !opts.externallyEditedJobs?.has(job.id) &&
        job.enabled === false &&
        job.description === description &&
        (hold.revision === undefined ||
          job.updatedAtMs === hold.revision ||
          finishedHeldRun);
      if (stillOurs && isRecurringJob(job)) {
        const unconfirmed = hold.revision === undefined;
        if (unconfirmed) {
          // Recover a confirmed pause after a crash between update and save.
          hold.revision = job.updatedAtMs;
          recordChange(job.id, 'paused');
        }
        if (limited) {
          if (unconfirmed || finishedHeldRun) {
            hold.revision = job.updatedAtMs;
            delete hold.runningAtMs;
            await save();
          }
          continue;
        }
        await cron.update(job.id, {
          enabled: true,
          description: hold.description,
        });
        delete state.holds[job.id];
        recordChange(job.id, 'resumed');
        await save();
        continue;
      }
      // A user/SRE changed the job while held. Never undo their disable or
      // other edits on recovery. Remove our label if it is still unchanged.
      if (job.description === description) {
        await cron.update(job.id, { description: hold.description });
        job.description = hold.description;
      }
      delete state.holds[job.id];
      await save();
      hold = undefined;
    }
    if (!limited || job.enabled === false || !isRecurringJob(job)) continue;
    // Persist intent first: a process crash between cron.update and the next
    // save must not strand a disabled job without a recoverable hold.
    hold = {
      description: job.description ?? '',
      ...(job.state?.runningAtMs !== undefined
        ? { runningAtMs: job.state.runningAtMs }
        : {}),
    };
    state.holds[job.id] = hold;
    await save();
    await cron.update(job.id, {
      enabled: false,
      description: (BUDGET_HOLD_PREFIX + hold.description).trimEnd(),
    });
    const updated = (await cron.list({ includeDisabled: true })).find(
      (j) => j.id === job.id
    );
    if (
      updated?.enabled === false &&
      updated.description === (BUDGET_HOLD_PREFIX + hold.description).trimEnd()
    ) {
      hold.revision = updated.updatedAtMs;
      recordChange(job.id, 'paused');
    }
    await save();
  }

  const count = Object.keys(state.holds).length;
  const now = (opts.now ?? Date.now)();
  if (
    limited &&
    count > 0 &&
    !state.notified &&
    opts.notify &&
    now >= (state.nextNotificationAtMs ?? 0)
  ) {
    // Persist before delivery so throws or restarts cannot reset the backoff.
    // Reconciliation still runs every five seconds, independently of notices.
    const attempts = state.notificationAttempts ?? 0;
    state.notificationAttempts = Math.min(attempts + 1, 5);
    state.nextNotificationAtMs =
      now + Math.min(60_000 * 2 ** Math.min(attempts, 4), 900_000);
    await save();
    if (
      await opts.notify(
        `Your token credits are low. Your ${count} scheduled ${count === 1 ? 'task has' : 'tasks have'} been paused.`
      )
    ) {
      state.notified = true;
      delete state.notificationAttempts;
      delete state.nextNotificationAtMs;
      await save();
    }
  }
  if (!limited) {
    state.limited = false;
    state.notified = false;
    delete state.notifiedRecipients;
    delete state.notificationAttempts;
    delete state.nextNotificationAtMs;
    await save();
  }
}
