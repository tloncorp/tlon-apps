// The model fills every field of the cron tool's schema, whether or not it
// means to set it: empty strings, nulls, `fallbacks: []`, a schedule of every
// 1 ms, a trigger with a filler script, `sessionTarget: "main"`, delivery mode
// "none". Core rejects some of that outright ("cron patch agentId cannot be
// changed", "cron triggers are disabled") and quietly applies the rest, which
// can strip a job's delivery or make a scheduled run strict about fallbacks.
// This keeps what the model actually set and drops the placeholders before the
// call runs.

type Json = Record<string, unknown>;

const MIN_EVERY_MS = 60_000;
// Fields an update has no business changing on its own initiative; the model
// only ever sets them to the schema's first enum value.
const UPDATE_PLACEHOLDER_FIELDS = ['sessionTarget', 'wakeMode'];
const CRON_ACTION_FIELDS = new Set([
  'action',
  'job',
  'patch',
  'jobId',
  'id',
  'includeDisabled',
  'timeoutMs',
]);

const isObject = (value: unknown): value is Json =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Drop nulls, empty strings, empty arrays and objects left empty by that. */
function prune(value: unknown): unknown {
  if (value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    const items = value.map(prune).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (!isObject(value)) return value;
  const entries = Object.entries(value)
    .map(([key, item]) => [key, prune(item)] as const)
    .filter(([, item]) => item !== undefined);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

type CleanOptions = {
  /** `cron.triggers.enabled`; core refuses every trigger while it's off. */
  triggersEnabled?: boolean;
};

/** Whether this gateway runs trigger scripts at all. */
export function cronTriggersEnabled(config: unknown): boolean {
  const cron = isObject(config) ? config.cron : undefined;
  const triggers = isObject(cron) ? cron.triggers : undefined;
  return isObject(triggers) && triggers.enabled === true;
}

/** One job or patch, with placeholders that would change the job removed. */
function cleanJob(
  raw: unknown,
  isPatch: boolean,
  options: CleanOptions
): Json | undefined {
  const job = prune(raw);
  if (!isObject(job)) return undefined;

  delete job.owner;
  // The model sends a trigger on nearly every call, its script filler ("x",
  // "unused", `return { fire: false };`). Core refuses any trigger while
  // triggers are off, which they are on hosted bots, so it can only go.
  if (!options.triggersEnabled) delete job.trigger;
  if (isObject(job.schedule)) {
    const schedule = job.schedule;
    if (schedule.anchorMs === 0) delete schedule.anchorMs;
    if (schedule.staggerMs === 0) delete schedule.staggerMs;
    if (
      schedule.kind === 'every' &&
      !(Number(schedule.everyMs) >= MIN_EVERY_MS)
    ) {
      delete job.schedule;
    }
  }
  if (isObject(job.payload)) {
    const payload = job.payload;
    if (payload.timeoutSeconds === 0) delete payload.timeoutSeconds;
    if (!payload.text && !payload.message) delete job.payload;
  }
  if (isObject(job.delivery)) {
    const delivery = job.delivery;
    // bestEffort: true suppresses the job's failure alert.
    delete delivery.bestEffort;
    if (
      isObject(delivery.failureDestination) &&
      !delivery.failureDestination.to
    ) {
      delete delivery.failureDestination;
    }
    // Without a target it's the schema's placeholder, and mode "none" would
    // switch off the job's delivery.
    if (!delivery.to) delete job.delivery;
  }
  if (isObject(job.failureAlert) && !job.failureAlert.to) {
    delete job.failureAlert;
  }
  if (isPatch) {
    for (const field of UPDATE_PLACEHOLDER_FIELDS) delete job[field];
  }
  return Object.keys(job).length ? job : undefined;
}

/**
 * The cron call as the model meant it, or undefined when there's nothing to
 * clean (not an add or update).
 */
export function cleanCronToolArgs(
  params: unknown,
  options: CleanOptions = {}
): Json | undefined {
  if (!isObject(params)) return undefined;
  const { action } = params;
  if (action !== 'add' && action !== 'update') return undefined;

  // Core also takes flat and wrapped spellings of a job. Only the nested form
  // the tool's schema advertises is cleaned; anything else goes through as
  // sent, rather than losing the fields this doesn't recognise.
  const described =
    action === 'add'
      ? isObject(params.job)
      : isObject(params.patch) || isObject(params.job);
  if (!described) return undefined;

  const cleaned: Json = {};
  for (const [key, value] of Object.entries(params)) {
    if (!CRON_ACTION_FIELDS.has(key)) continue;
    if (key === 'job' || key === 'patch') continue;
    const item = prune(value);
    if (item !== undefined) cleaned[key] = item;
  }
  // An add describes the job; an update describes only the change.
  if (action === 'add') {
    const job = cleanJob(params.job, false, options);
    if (job) cleaned.job = job;
  } else {
    // A change sent only as `job` is still the change.
    const patch = cleanJob(params.patch ?? params.job, true, options);
    if (patch) cleaned.patch = patch;
  }
  return cleaned;
}
