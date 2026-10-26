// The model fills every field of the cron tool's schema, whether or not it
// means to set it: empty strings, nulls, `fallbacks: []`, a schedule of every
// 1 ms, a trigger that never fires, `sessionTarget: "main"`, delivery mode
// "none", and every schedule and payload kind's fields at once. Core rejects
// some of that outright ("cron patch agentId cannot be changed") and quietly
// applies the rest, which can strip a job's delivery or make a scheduled run
// strict about fallbacks. This keeps what the model actually set and drops the
// placeholders before the call runs. A null would clear a field on update, but
// the model sends null for every nullable field, so null reads as unset.

type Json = Record<string, unknown>;

const MIN_EVERY_MS = 60_000;
const NEVER_FIRES = /^\s*return\s*\{\s*fire\s*:\s*false\s*\}\s*;?\s*$/;
// What the model writes into `declarationKey` (which can't be empty) and a
// systemEvent's `text` when it means to leave them unset.
const PLACEHOLDER_STRINGS = new Set(['x', 'placeholder']);
// Fields an update has no business changing on its own initiative; the model
// only ever sets them to the schema's first enum value.
const UPDATE_PLACEHOLDER_FIELDS = ['sessionTarget', 'wakeMode'];
// Core's schedules and payloads are closed per kind, so a field that belongs
// to another kind fails the whole call.
const SCHEDULE_FIELDS: Record<string, string[]> = {
  at: ['at'],
  every: ['everyMs', 'anchorMs'],
  cron: ['expr', 'tz', 'staggerMs'],
  'on-exit': ['command', 'cwd'],
  stream: ['command', 'cwd', 'mode', 'match', 'batchMs', 'maxBatchBytes'],
};
const PAYLOAD_FIELDS: Record<string, string[]> = {
  systemEvent: ['text', 'toolsAllow'],
  agentTurn: [
    'message',
    'model',
    'fallbacks',
    'thinking',
    'timeoutSeconds',
    'allowUnsafeExternalContent',
    'lightContext',
    'toolsAllow',
  ],
  command: [
    'argv',
    'cwd',
    'env',
    'input',
    'timeoutSeconds',
    'noOutputTimeoutSeconds',
    'outputMaxBytes',
    'toolsAllow',
  ],
  script: ['script', 'timeoutSeconds', 'toolBudget', 'toolsAllow'],
};
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

const isPlaceholder = (value: unknown) =>
  typeof value === 'string' && PLACEHOLDER_STRINGS.has(value);

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

/**
 * The value without the fields of other kinds, or undefined when nothing but
 * its kind is left. Fields no kind lists, such as the `atMs` and `cron`
 * spellings core canonicalizes, stay; a kind this doesn't know passes through.
 */
function dropOtherKindsFields(
  value: Json,
  fieldsByKind: Record<string, string[]>
): Json | undefined {
  const own = fieldsByKind[String(value.kind)];
  if (!own) return value;
  const others = new Set(
    Object.values(fieldsByKind)
      .flat()
      .filter((field) => !own.includes(field))
  );
  const kept = Object.fromEntries(
    Object.entries(value).filter(([key]) => !others.has(key))
  );
  return Object.keys(kept).some((key) => key !== 'kind') ? kept : undefined;
}

/** One job or patch, with placeholders that would change the job removed. */
function cleanJob(raw: unknown, isPatch: boolean): Json | undefined {
  const job = prune(raw);
  if (!isObject(job)) return undefined;

  delete job.owner;
  if (isPlaceholder(job.declarationKey)) delete job.declarationKey;
  if (isObject(job.trigger) && NEVER_FIRES.test(String(job.trigger.script))) {
    delete job.trigger;
  }
  if (isObject(job.schedule)) {
    const schedule = job.schedule;
    if (schedule.anchorMs === 0) delete schedule.anchorMs;
    if (schedule.staggerMs === 0) delete schedule.staggerMs;
    const kept = dropOtherKindsFields(schedule, SCHEDULE_FIELDS);
    if (
      !kept ||
      (kept.kind === 'every' && !(Number(kept.everyMs) >= MIN_EVERY_MS))
    ) {
      delete job.schedule;
    } else {
      job.schedule = kept;
    }
  }
  if (isObject(job.payload)) {
    const payload = job.payload;
    if (payload.timeoutSeconds === 0) delete payload.timeoutSeconds;
    if (isPlaceholder(payload.text)) delete payload.text;
    // An update may change one field of the payload and keep its prompt.
    const kept = dropOtherKindsFields(payload, PAYLOAD_FIELDS);
    if (kept) job.payload = kept;
    else delete job.payload;
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
  // false switches off the job's failure alerts, the same as bestEffort.
  if (
    job.failureAlert === false ||
    (isObject(job.failureAlert) && !job.failureAlert.to)
  ) {
    delete job.failureAlert;
  }
  if (isPatch) {
    for (const field of UPDATE_PLACEHOLDER_FIELDS) delete job[field];
    // Core takes a declaration key only when adding a job.
    delete job.declarationKey;
  }
  return Object.keys(job).length ? job : undefined;
}

/**
 * The cron call as the model meant it, or undefined when there's nothing to
 * clean (not an add or update).
 */
export function cleanCronToolArgs(params: unknown): Json | undefined {
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
    const job = cleanJob(params.job, false);
    if (job) cleaned.job = job;
  } else {
    // A change sent only as `job` is still the change. Core 2026.7 reads it
    // from `patch` and 2026.9 from `job`, and core lays the returned call over
    // the model's rather than replacing it, so both carry the cleaned change.
    const patch = cleanJob(params.patch ?? params.job, true);
    if (patch) {
      cleaned.patch = patch;
      cleaned.job = patch;
    }
  }
  return cleaned;
}
