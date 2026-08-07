/**
 * Repairs for `cron` tool calls before they reach the scheduler.
 *
 * Models compose these calls by filling in the whole parameter shape, empty
 * values included. Most empties fail the scheduler's schema (`""` where a
 * channel id belongs, `after: 0` below the minimum), so the setup ends with
 * no job at all. One is worse: `toolsAllow: []` is an allow-list that allows
 * nothing — the call succeeds and the job wakes on schedule with zero tools,
 * able only to announce that it is blocked. Prompting against this wasn't
 * enough — the fields kept coming back — so the empties are dropped here,
 * where they can't be argued with. Anything the model actually filled in is
 * left exactly as written.
 */

const HOME_GROUP_SESSION_SUFFIX = '/home-group-chat';
const ONBOARDING_JOB_NAME_PREFIXES = [
  'daily digest',
  'tracking check-in',
  'research update',
] as const;

/** The production onboarding conversation has one deterministic session. */
export function isHomeGroupOnboardingSessionKey(
  sessionKey: string | null | undefined
): boolean {
  return (
    typeof sessionKey === 'string' &&
    sessionKey.includes(':tlon:group:chat/') &&
    sessionKey.endsWith(HOME_GROUP_SESSION_SUFFIX)
  );
}

function isTimeSchedule(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const kind = (value as Record<string, unknown>).kind;
  return kind === 'at' || kind === 'every' || kind === 'cron';
}

function isOnboardingJobName(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return ONBOARDING_JOB_NAME_PREFIXES.some(
    (prefix) =>
      normalized === prefix ||
      normalized.startsWith(`${prefix}:`) ||
      normalized.startsWith(`${prefix} —`) ||
      normalized.startsWith(`${prefix} -`)
  );
}

function shouldDropUnsupportedOnboardingTrigger(
  container: Record<string, unknown>,
  requireKnownName: boolean
): boolean {
  return (
    'trigger' in container &&
    isTimeSchedule(container.schedule) &&
    (!requireKnownName || isOnboardingJobName(container.name))
  );
}

/** True for values the schema would reject but the model means as "unset". */
function isBlank(value: unknown): boolean {
  return typeof value === 'string' && value.trim() === '';
}

/**
 * Drop blank-valued keys, and any nested object left with nothing meaningful.
 * Returns undefined when the whole object is empty, so callers can drop it.
 */
function pruneBlanks(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return isBlank(value) ? undefined : value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const pruned = pruneBlanks(raw);
    if (pruned !== undefined) {
      out[key] = pruned;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// `failureDestination` needs a real channel and target, so a husk of empty
// strings has to go rather than be pruned down to `{mode}`, which fails the
// same validation.
function repairDelivery(delivery: unknown): unknown {
  const pruned = pruneBlanks(delivery);
  if (!pruned || typeof pruned !== 'object') {
    return undefined;
  }
  const next = { ...(pruned as Record<string, unknown>) };
  const dest = next.failureDestination as Record<string, unknown> | undefined;
  if (dest && (!dest.channel || !dest.to)) {
    delete next.failureDestination;
  }
  // A delivery reduced to its mode is the same husk one level up: announce
  // and explicit modes need a target, so without one the whole block goes.
  // Except `none`: it means "don't deliver" and needs no target — dropping
  // it would fall back to the runner default (announce) and turn a
  // deliberately silent job into an announcing one.
  if (next.mode !== 'none' && !next.to && !next.channel) {
    return undefined;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** `after` counts runs, so anything below 1 is the model filling in a zero. */
function repairFailureAlert(alert: unknown): unknown {
  if (typeof alert === 'boolean') {
    return alert;
  }
  const pruned = pruneBlanks(alert);
  if (!pruned || typeof pruned !== 'object') {
    return undefined;
  }
  const next = { ...(pruned as Record<string, unknown>) };
  if (typeof next.after === 'number' && next.after < 1) {
    delete next.after;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * A cron call with the model's empty filler removed, or null when there was
 * nothing to repair — so callers can skip the rewrite in the common case.
 */
export function sanitizeCronToolParams(
  params: unknown,
  options?: { stripUnsupportedOnboardingTrigger?: boolean }
): Record<string, unknown> | null {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return null;
  }
  const source = params as Record<string, unknown>;
  const job = source.job;
  const patch = source.patch;
  let nextJob: Record<string, unknown> | undefined;
  if (job && typeof job === 'object' && !Array.isArray(job)) {
    nextJob = { ...(job as Record<string, unknown>) };
  }
  let changed = false;

  if (
    nextJob &&
    options?.stripUnsupportedOnboardingTrigger &&
    shouldDropUnsupportedOnboardingTrigger(nextJob, true)
  ) {
    delete nextJob.trigger;
    changed = true;
  }

  const payload = nextJob?.payload as Record<string, unknown> | undefined;
  if (
    payload &&
    Array.isArray(payload.toolsAllow) &&
    payload.toolsAllow.length === 0
  ) {
    const nextPayload = { ...payload };
    delete nextPayload.toolsAllow;
    nextJob!.payload = nextPayload;
    changed = true;
  }

  if (nextJob && 'delivery' in nextJob) {
    const repaired = repairDelivery(nextJob.delivery);
    if (JSON.stringify(repaired) !== JSON.stringify(nextJob.delivery)) {
      if (repaired === undefined) {
        delete nextJob.delivery;
      } else {
        nextJob.delivery = repaired;
      }
      changed = true;
    }
  }

  if (nextJob && 'failureAlert' in nextJob) {
    const repaired = repairFailureAlert(nextJob.failureAlert);
    if (JSON.stringify(repaired) !== JSON.stringify(nextJob.failureAlert)) {
      if (repaired === undefined) {
        delete nextJob.failureAlert;
      } else {
        nextJob.failureAlert = repaired;
      }
      changed = true;
    }
  }

  let nextPatch: Record<string, unknown> | undefined;
  if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
    nextPatch = { ...(patch as Record<string, unknown>) };
    if (
      options?.stripUnsupportedOnboardingTrigger &&
      shouldDropUnsupportedOnboardingTrigger(nextPatch, true)
    ) {
      delete nextPatch.trigger;
      changed = true;
    }
  }

  if (!changed) {
    return null;
  }
  return {
    ...source,
    ...(nextJob ? { job: nextJob } : {}),
    ...(nextPatch ? { patch: nextPatch } : {}),
  };
}
