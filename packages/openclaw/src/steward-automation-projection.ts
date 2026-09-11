import type { PluginHookGatewayCronJob } from 'openclaw/plugin-sdk/types';
import { z } from 'zod';

const EXPECTED_NUMBER = 'expected a number';
const EXPECTED_SAFE_INTEGER = 'expected a safe integer';
const EXPECTED_NON_NEGATIVE_NUMBER = 'expected a non-negative number';
const EXPECTED_ISO_TIMESTAMP = 'expected an ISO timestamp';

const ExpectedStringSchema = z.string({ error: 'expected a string' });
const NaturalNumberSchema = z
  .int({
    error: (issue) =>
      issue.code === 'invalid_type' && issue.expected === 'number'
        ? EXPECTED_NUMBER
        : EXPECTED_SAFE_INTEGER,
  })
  .nonnegative({ error: EXPECTED_NON_NEGATIVE_NUMBER });
const IsoTimestampMillisecondsSchema = z.iso
  .datetime({ offset: true, error: EXPECTED_ISO_TIMESTAMP })
  .transform(Date.parse)
  .pipe(
    z
      .int({ error: EXPECTED_ISO_TIMESTAMP })
      .nonnegative({ error: EXPECTED_ISO_TIMESTAMP })
  );

const PayloadSchema = z
  .object({
    kind: ExpectedStringSchema.optional(),
    message: ExpectedStringSchema.optional(),
    text: ExpectedStringSchema.optional(),
  })
  .transform(({ kind, message: currentMessage, text: fallbackText }) => {
    // Current OpenClaw runtime values use `message`. Accept `text` only as a
    // fallback for the stale pinned 2026.5.28 plugin declaration.
    const message = currentMessage ?? fallbackText;
    return {
      ...(kind === undefined ? {} : { kind }),
      ...(message === undefined ? {} : { message }),
    };
  });

const CronScheduleSchema = z
  .object({
    kind: z.literal('cron'),
    expr: ExpectedStringSchema.optional(),
    tz: ExpectedStringSchema.optional(),
    staggerMs: NaturalNumberSchema.optional(),
  })
  .transform(({ kind, expr, tz, staggerMs }) => ({
    kind,
    ...(expr === undefined ? {} : { expr }),
    ...(tz === undefined ? {} : { tz }),
    ...(staggerMs === undefined ? {} : { staggerMs }),
  }));

const AtScheduleSchema = z
  .object({
    kind: z.literal('at'),
    at: IsoTimestampMillisecondsSchema.optional(),
  })
  .transform(({ kind, at }) => ({
    kind,
    ...(at === undefined ? {} : { at }),
  }));

const EveryScheduleSchema = z
  .object({
    kind: z.literal('every'),
    everyMs: NaturalNumberSchema.optional(),
    anchorMs: NaturalNumberSchema.optional(),
  })
  .transform(({ kind, everyMs, anchorMs }) => ({
    kind,
    ...(everyMs === undefined ? {} : { everyMs }),
    ...(anchorMs === undefined ? {} : { anchorMs }),
  }));

const ScheduleSchema = z.discriminatedUnion('kind', [
  CronScheduleSchema,
  AtScheduleSchema,
  EveryScheduleSchema,
]);

const CronJobSchema = z
  .object({
    id: ExpectedStringSchema,
    agentId: ExpectedStringSchema.optional(),
    name: ExpectedStringSchema.optional(),
    description: ExpectedStringSchema.optional(),
    enabled: z.boolean({ error: 'expected a boolean' }).optional(),
    schedule: ScheduleSchema.optional(),
    sessionTarget: ExpectedStringSchema.optional(),
    wakeMode: ExpectedStringSchema.optional(),
    payload: PayloadSchema.optional(),
    createdAtMs: NaturalNumberSchema.optional(),
    updatedAtMs: NaturalNumberSchema.optional(),
  })
  .transform(
    ({
      id,
      agentId,
      name,
      description,
      enabled,
      schedule,
      sessionTarget,
      wakeMode,
      payload,
      createdAtMs,
      updatedAtMs,
    }) => ({
      id,
      ...(agentId === undefined ? {} : { agentId }),
      ...(name === undefined ? {} : { name }),
      ...(description === undefined ? {} : { description }),
      ...(enabled === undefined ? {} : { enabled }),
      ...(schedule === undefined ? {} : { schedule }),
      ...(sessionTarget === undefined ? {} : { sessionTarget }),
      ...(wakeMode === undefined ? {} : { wakeMode }),
      ...(payload === undefined ? {} : { payload }),
      ...(createdAtMs === undefined ? {} : { createdAtMs }),
      ...(updatedAtMs === undefined ? {} : { updatedAtMs }),
    })
  );

export type StewardAutomationSchedule = z.output<typeof ScheduleSchema>;
export type StewardAutomationPayload = z.output<typeof PayloadSchema>;
export type StewardAutomationTask = z.output<typeof CronJobSchema>;

export interface StewardAutomationProjection {
  project: {
    tasks: StewardAutomationTask[];
  };
}

const CronJobIdentitySchema = z.object({ id: z.string() });
const ScheduleKindSchema = z.object({
  schedule: z.object({ kind: z.unknown() }),
});

function formatCronJobError(error: z.ZodError, job: unknown): Error {
  const issue = error.issues[0];
  const identity = CronJobIdentitySchema.safeParse(job);
  const jobLabel = identity.success
    ? `cron job ${identity.data.id}`
    : 'cron job';
  const path = issue?.path.map(String).join('.') ?? '';

  if (path === 'schedule.kind' && issue?.code === 'invalid_union') {
    const scheduleKind = ScheduleKindSchema.safeParse(job);
    const kind = scheduleKind.success
      ? String(scheduleKind.data.schedule.kind)
      : 'undefined';
    return new Error(
      `Invalid ${jobLabel} schedule.kind: unsupported value ${kind}`
    );
  }

  const field =
    path === 'id' ? 'cron job id' : [jobLabel, path].filter(Boolean).join(' ');
  let message = issue?.message ?? 'invalid value';
  if (issue?.code === 'invalid_type' && issue.expected === 'object') {
    message = 'expected an object';
  }
  return new Error(`Invalid ${field}: ${message}`);
}

function normalizeTask(job: PluginHookGatewayCronJob): StewardAutomationTask {
  const parsed = CronJobSchema.safeParse(job);
  if (!parsed.success) {
    throw formatCronJobError(parsed.error, job);
  }
  return parsed.data;
}

/** Normalize one complete OpenClaw cron list into Steward's `%project` JSON. */
export function normalizeStewardAutomationProjection(
  jobs: readonly PluginHookGatewayCronJob[]
): StewardAutomationProjection {
  const seenIds = new Set<string>();
  const tasks = jobs.map((job) => {
    const task = normalizeTask(job);
    if (seenIds.has(task.id)) {
      throw new Error(`Duplicate cron job id: ${task.id}`);
    }
    seenIds.add(task.id);
    return task;
  });
  return { project: { tasks } };
}
