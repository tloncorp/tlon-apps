import { FINAL_STATUSES } from './Channel/ContextLens/types';
import type { ContextLens } from './Channel/ContextLens/types';

/** How one run of a scheduled task went, as the owner would put it. */
export type TaskRunOutcome = 'running' | 'successful' | 'failed' | 'no-output';

export const TASK_RUN_OUTCOME_LABELS: Record<TaskRunOutcome, string> = {
  running: 'Running',
  successful: 'Successful',
  failed: 'Failed',
  'no-output': 'No output',
};

export const TASK_RUN_OUTCOME_COLORS: Record<TaskRunOutcome, string> = {
  running: '$secondaryText',
  successful: '$positiveActionText',
  failed: '$negativeActionText',
  'no-output': '$tertiaryText',
};

type CronOutcome = NonNullable<NonNullable<ContextLens['cron']>['outcome']>;

/**
 * A run that chose to say nothing, which the host also reports as not
 * delivered: no error, and a reply that is empty or NO_REPLY. The plugin's
 * cron telemetry draws the same line.
 */
function isSilent(outcome: CronOutcome) {
  const summary = outcome.summary?.trim();
  return (
    outcome.status === 'ok' &&
    outcome.deliveryStatus === 'not-delivered' &&
    !outcome.error?.trim() &&
    !outcome.deliveryError?.trim() &&
    (!summary || summary.toUpperCase() === 'NO_REPLY')
  );
}

/** Output the run produced that the host could not post. */
function deliveryFailed(outcome: CronOutcome | undefined) {
  return outcome?.deliveryStatus === 'not-delivered' && !isSilent(outcome);
}

/**
 * The host's verdict when there is one, since the lens alone cannot tell a
 * reply that was posted from one that failed to post; the lens otherwise.
 */
export function taskRunOutcome(lens: ContextLens): TaskRunOutcome {
  if (!FINAL_STATUSES.has(lens.status)) {
    return 'running';
  }
  const outcome = lens.cron?.outcome;
  if (
    outcome?.status === 'error' ||
    deliveryFailed(outcome) ||
    lens.status === 'error' ||
    lens.status === 'timed_out' ||
    lens.status === 'aborted'
  ) {
    return 'failed';
  }
  if (
    outcome?.status === 'skipped' ||
    (outcome && isSilent(outcome)) ||
    lens.status === 'no_reply'
  ) {
    return 'no-output';
  }
  return 'successful';
}

/** Why a failed run failed, in the words it was reported in. */
export function taskRunError(lens: ContextLens): string | null {
  const outcome = lens.cron?.outcome;
  return (
    outcome?.error?.trim() ||
    (deliveryFailed(outcome)
      ? outcome?.deliveryError?.trim() || 'The output could not be posted.'
      : null) ||
    lens.error?.trim() ||
    null
  );
}

/**
 * What the run produced: a test run's kept reply, or what a scheduled run
 * posted, falling back to the host's summary of it.
 */
export function taskRunOutput(lens: ContextLens): string | null {
  if (lens.cron?.output?.trim()) {
    return lens.cron.output.trim();
  }
  const posted = (lens.outputs ?? [])
    .map((output) => output.preview?.trim())
    .filter(Boolean)
    .join('\n\n');
  return posted || lens.cron?.outcome?.summary?.trim() || null;
}

export function isTestRun(lens: ContextLens) {
  return lens.cron?.test === true;
}

function startOfDay(ms: number) {
  const day = new Date(ms);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

const DAY_MS = 86_400_000;

/** "Today", "Yesterday", a weekday within the week, else a date. */
export function formatRunDay(ms: number, now: number) {
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / DAY_MS);
  if (days === 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Yesterday';
  }
  const date = new Date(ms);
  if (days > 1 && days < 7) {
    return date.toLocaleDateString([], { weekday: 'long' });
  }
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === new Date(now).getFullYear()
      ? {}
      : { year: 'numeric' }),
  });
}

export function formatRunTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * The line under Run History on the task's screen, from its runs newest
 * first: the last scheduled run and how it went. Test runs speak for
 * themselves only when the task has not run on its schedule yet.
 */
export function runHistorySubtitle(runs: ContextLens[], now: number) {
  const scheduled = runs.find((lens) => !isTestRun(lens));
  const last = scheduled ?? runs[0];
  if (!last) {
    return 'No runs yet';
  }
  const outcome = taskRunOutcome(last);
  const noun = scheduled ? 'run' : 'test';
  if (outcome === 'running') {
    return scheduled ? 'Running now' : 'Testing now';
  }
  return `Last ${noun} ${formatRunDay(last.createdAt, now)}, ${TASK_RUN_OUTCOME_LABELS[outcome].toLowerCase()}`;
}

export interface TaskRunDay {
  key: string;
  label: string;
  runs: ContextLens[];
}

/** Runs newest first, cut into days for the timeline. */
export function groupRunsByDay(runs: ContextLens[], now: number): TaskRunDay[] {
  const days: TaskRunDay[] = [];
  for (const lens of runs) {
    const key = String(startOfDay(lens.createdAt));
    const current = days.at(-1);
    if (current?.key === key) {
      current.runs.push(lens);
    } else {
      days.push({
        key,
        label: formatRunDay(lens.createdAt, now),
        runs: [lens],
      });
    }
  }
  return days;
}
