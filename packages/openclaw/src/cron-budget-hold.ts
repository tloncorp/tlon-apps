import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { PluginHookGatewayCronJob } from 'openclaw/plugin-sdk/types';

export const BUDGET_SIGNAL_ENV = 'TLON_CRON_BUDGET_FILE';
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
  list: (opts: {
    includeDisabled: true;
  }) => Promise<PluginHookGatewayCronJob[]>;
  update: (
    id: string,
    patch: { enabled?: boolean; description?: string }
  ) => Promise<unknown>;
};

type Hold = {
  description: string;
  // A missing revision is a write-ahead intent, recovered after a crash.
  revision?: number;
  // Core records an interrupted run during startup and advances updatedAtMs.
  // That runtime bookkeeping is not a manual edit to the held task.
  startupRunAtMs?: number;
};
export type BudgetHoldState = {
  version: 1;
  limited: boolean;
  notified: boolean;
  episodeId?: string;
  holds: Record<string, Hold>;
};

export const emptyBudgetHoldState = (): BudgetHoldState => ({
  version: 1,
  limited: false,
  notified: false,
  holds: {},
});

export function isRecurringJob(job: PluginHookGatewayCronJob): boolean {
  return job.schedule?.kind === 'cron' || job.schedule?.kind === 'every';
}

export async function readBudgetSignal(path: string): Promise<BudgetState> {
  try {
    const data = JSON.parse(await readFile(path, 'utf8'));
    return data.version === 1 &&
      (data.state === 'limited' || data.state === 'available')
      ? data.state
      : 'unknown';
  } catch {
    // Probe/file failures cannot release an existing hold.
    return 'unknown';
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
    !data.holds ||
    Array.isArray(data.holds) ||
    typeof data.holds !== 'object' ||
    Object.values(data.holds).some((hold) => {
      const h = hold as Hold;
      return (
        !h ||
        typeof h.description !== 'string' ||
        (h.revision !== undefined && !Number.isFinite(h.revision)) ||
        (h.startupRunAtMs !== undefined && !Number.isFinite(h.startupRunAtMs))
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
}): Promise<void> {
  const { state, cron, save } = opts;
  if (opts.budget === 'limited' && !state.limited) {
    state.limited = true;
    state.notified = false;
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
      const description = BUDGET_HOLD_PREFIX + hold.description;
      const finishedStartupRun =
        hold.startupRunAtMs !== undefined &&
        job.state?.runningAtMs === undefined &&
        job.state?.lastRunAtMs === hold.startupRunAtMs &&
        job.state?.lastRunStatus === 'error';
      const stillOurs =
        job.enabled === false &&
        job.description === description &&
        (hold.revision === undefined ||
          job.updatedAtMs === hold.revision ||
          finishedStartupRun);
      if (stillOurs && isRecurringJob(job)) {
        if (limited) {
          if (hold.revision === undefined || finishedStartupRun) {
            hold.revision = job.updatedAtMs;
            delete hold.startupRunAtMs;
            await save();
          }
          continue;
        }
        await cron.update(job.id, {
          enabled: true,
          description: hold.description,
        });
        delete state.holds[job.id];
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
      ...(opts.pauseOnly && job.state?.runningAtMs !== undefined
        ? { startupRunAtMs: job.state.runningAtMs }
        : {}),
    };
    state.holds[job.id] = hold;
    await save();
    await cron.update(job.id, {
      enabled: false,
      description: BUDGET_HOLD_PREFIX + hold.description,
    });
    const updated = (await cron.list({ includeDisabled: true })).find(
      (j) => j.id === job.id
    );
    if (
      updated?.enabled === false &&
      updated.description === BUDGET_HOLD_PREFIX + hold.description
    ) {
      hold.revision = updated.updatedAtMs;
    }
    await save();
  }

  const count = Object.keys(state.holds).length;
  if (limited && count > 0 && !state.notified && opts.notify) {
    if (
      await opts.notify(
        `Your token credits are low. Your ${count} scheduled ${count === 1 ? 'task has' : 'tasks have'} been paused.`
      )
    ) {
      state.notified = true;
      await save();
    }
  }
  if (!limited) {
    state.limited = false;
    state.notified = false;
    await save();
  }
}
