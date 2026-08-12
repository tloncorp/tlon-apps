import type { PluginHookGatewayCronJob } from 'openclaw/plugin-sdk/types';
import { z } from 'zod';

export type StewardAutomationSchedule =
  | {
      kind: 'cron';
      expr?: string;
      tz?: string;
      staggerMs?: number;
    }
  | {
      kind: 'at';
      at?: number;
    }
  | {
      kind: 'every';
      everyMs?: number;
      anchorMs?: number;
    };

export interface StewardAutomationPayload {
  kind?: string;
  text?: string;
}

export interface StewardAutomationTask {
  id: string;
  agentId?: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  schedule?: StewardAutomationSchedule;
  sessionTarget?: string;
  wakeMode?: string;
  payload?: StewardAutomationPayload;
  createdAtMs?: number;
  updatedAtMs?: number;
}

export interface StewardAutomationProjectAction {
  project: {
    tasks: StewardAutomationTask[];
  };
}

const ExpectedStringSchema = z.string({ error: 'expected a string' });
const ExpectedBooleanSchema = z.boolean({ error: 'expected a boolean' });
const NaturalNumberSchema = z
  .number({ error: 'expected a non-negative safe integer' })
  .int({ error: 'expected a non-negative safe integer' })
  .safe({ error: 'expected a non-negative safe integer' })
  .nonnegative({ error: 'expected a non-negative safe integer' });
const IsoTimestampMillisecondsSchema = z.iso
  .datetime({ offset: true, error: 'expected an ISO timestamp' })
  .transform(Date.parse)
  .pipe(
    z
      .number({ error: 'expected an ISO timestamp' })
      .int({ error: 'expected an ISO timestamp' })
      .safe({ error: 'expected an ISO timestamp' })
      .nonnegative({ error: 'expected an ISO timestamp' })
  );

const PayloadSchema = z
  .object({
    kind: ExpectedStringSchema.optional(),
    text: ExpectedStringSchema.optional(),
    message: ExpectedStringSchema.optional(),
  })
  .transform(({ kind, text: declaredText, message: runtimeMessage }) => {
    // The pinned declaration says `text`; captured 2026.5.28 runtime values
    // use `message`. Validate both aliases and expose only Steward's `text`.
    const text = declaredText ?? runtimeMessage;
    return {
      ...(kind === undefined ? {} : { kind }),
      ...(text === undefined ? {} : { text }),
    } satisfies StewardAutomationPayload;
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
    enabled: ExpectedBooleanSchema.optional(),
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

type NormalizedCronJob = z.infer<typeof CronJobSchema>;

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
  const task: NormalizedCronJob = parsed.data;
  return task;
}

/** Normalize one complete OpenClaw cron list into Steward's `%project` JSON. */
export function normalizeStewardAutomationProject(
  jobs: readonly PluginHookGatewayCronJob[]
): StewardAutomationProjectAction {
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
