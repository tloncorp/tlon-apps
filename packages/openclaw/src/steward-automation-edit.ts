import type { PluginHookGatewayCronService } from 'openclaw/plugin-sdk/types';
import { z } from 'zod';

/**
 * The bot → harness leg of the Steward automation edit loop.
 *
 * The bot ship's %steward gives one `dispatch` fact per owner edit on
 * `/v1/automation/harness`; every outstanding command is replayed when the
 * harness (re)subscribes. This module parses a dispatch, maps it onto the
 * gateway `CronService`, applies it, and builds the `%finalize` action that
 * carries the typed outcome back. Steward never mutates its task map on an
 * edit — OpenClaw stays the only source of truth, and the change becomes
 * visible through the next `%project` reconciliation.
 *
 * The plugin SDK's `.d.ts` understates the cron service's accepted input (it
 * types only cron-expression schedules and a `text` payload), while
 * `getCron()` hands us the real service, which accepts the full gateway
 * schema. The mapping below targets that schema and casts past the narrow
 * declaration, exactly as the projection normalizer does for reads.
 */

export const STEWARD_AUTOMATION_ACTION_MARK = 'steward-automation-action-1';
export const STEWARD_AUTOMATION_HARNESS_PATH = '/v1/automation/harness';
const STEWARD_JOB_ID_PREFIX = 'steward-';

const ExpectedStringSchema = z.string({ error: 'expected a string' });
const NaturalNumberSchema = z
  .int({ error: 'expected a non-negative integer' })
  .nonnegative({ error: 'expected a non-negative integer' });

const DispatchScheduleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('cron'),
    expr: ExpectedStringSchema.optional(),
    tz: ExpectedStringSchema.optional(),
    staggerMs: NaturalNumberSchema.optional(),
  }),
  z.object({
    kind: z.literal('at'),
    at: NaturalNumberSchema.optional(),
  }),
  z.object({
    kind: z.literal('every'),
    everyMs: NaturalNumberSchema.optional(),
    anchorMs: NaturalNumberSchema.optional(),
  }),
]);

const DispatchPayloadSchema = z.object({
  kind: ExpectedStringSchema.optional(),
  message: ExpectedStringSchema.optional(),
});

const DispatchTaskSchema = z.object({
  agentId: ExpectedStringSchema.optional(),
  name: ExpectedStringSchema.optional(),
  description: ExpectedStringSchema.optional(),
  enabled: z.boolean({ error: 'expected a boolean' }).optional(),
  schedule: DispatchScheduleSchema.optional(),
  sessionTarget: ExpectedStringSchema.optional(),
  wakeMode: ExpectedStringSchema.optional(),
  payload: DispatchPayloadSchema.optional(),
  createdAtMs: NaturalNumberSchema.optional(),
  updatedAtMs: NaturalNumberSchema.optional(),
});

const DispatchEditSchema = z.union([
  z.object({ create: DispatchTaskSchema }),
  z.object({ update: DispatchTaskSchema.extend({ id: ExpectedStringSchema }) }),
  z.object({ delete: z.object({ id: ExpectedStringSchema }) }),
]);

const DispatchSchema = z.object({
  requestId: ExpectedStringSchema,
  action: DispatchEditSchema,
});

const DispatchIdentitySchema = z.object({ requestId: z.string() });

export type StewardAutomationDispatchTask = z.output<typeof DispatchTaskSchema>;
export type StewardAutomationDispatch = z.output<typeof DispatchSchema>;

export type StewardAutomationEditErrorType =
  | 'not-found'
  | 'invalid'
  | 'harness-error';

export type StewardAutomationResponseBody =
  | { type: 'created' | 'updated' | 'deleted'; id: string }
  | {
      type: 'error';
      errorType: StewardAutomationEditErrorType;
      message: string[];
    };

export interface StewardAutomationFinalizeAction {
  finalize: {
    requestId: string;
    body: StewardAutomationResponseBody;
  };
}

export type StewardAutomationCronWriteService = Pick<
  PluginHookGatewayCronService,
  'add' | 'update' | 'remove'
>;

export class StewardAutomationDispatchError extends Error {
  constructor(
    message: string,
    readonly requestId: string | null
  ) {
    super(message);
    this.name = 'StewardAutomationDispatchError';
  }
}

function formatIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue?.path.map(String).join('.') ?? '';
  const message = issue?.message ?? 'invalid value';
  return path ? `${path}: ${message}` : message;
}

/** Parse one harness-feed fact. A malformed fact still surfaces its id when it has one. */
export function parseStewardAutomationDispatch(
  data: unknown
): StewardAutomationDispatch {
  const parsed = DispatchSchema.safeParse(data);
  if (parsed.success) {
    return parsed.data;
  }
  const identity = DispatchIdentitySchema.safeParse(data);
  throw new StewardAutomationDispatchError(
    `Invalid steward automation dispatch: ${formatIssue(parsed.error)}`,
    identity.success ? identity.data.requestId : null
  );
}

/**
 * A create is requested under a job id derived from the request id. Hosts
 * that honor a caller-supplied id (2026.7.1 and later) then reject a dispatch
 * replayed after the plugin applied it and died before answering as a
 * duplicate, instead of creating a second job. 2026.5.28 and earlier ignore
 * the requested id and assign their own, so the id reported back is always the
 * one the service returned, and replay is not idempotent there.
 */
export function deriveStewardAutomationJobId(requestId: string): string {
  return `${STEWARD_JOB_ID_PREFIX}${requestId}`;
}

/** The created job's id as the service reports it, whatever shape `add` returned. */
export function resolveCreatedJobId(result: unknown): string | undefined {
  if (typeof result !== 'object' || result === null) {
    return undefined;
  }
  const candidate = result as { id?: unknown; job?: { id?: unknown } };
  if (typeof candidate.id === 'string' && candidate.id) {
    return candidate.id;
  }
  if (typeof candidate.job?.id === 'string' && candidate.job.id) {
    return candidate.job.id;
  }
  return undefined;
}

type MappingResult<T> = { ok: true; value: T } | { ok: false; message: string };

function invalid<T>(message: string): MappingResult<T> {
  return { ok: false, message };
}

type CronSchedule =
  | { kind: 'cron'; expr: string; tz?: string; staggerMs?: number }
  | { kind: 'at'; at: string }
  | { kind: 'every'; everyMs: number; anchorMs?: number };

type CronPayload =
  | { kind: 'systemEvent'; text: string }
  | { kind: 'agentTurn'; message: string };

function mapSchedule(
  schedule: NonNullable<StewardAutomationDispatchTask['schedule']>
): MappingResult<CronSchedule> {
  switch (schedule.kind) {
    case 'cron':
      if (schedule.expr === undefined) {
        return invalid('schedule.expr is required for a cron schedule');
      }
      return {
        ok: true,
        value: {
          kind: 'cron',
          expr: schedule.expr,
          ...(schedule.tz === undefined ? {} : { tz: schedule.tz }),
          ...(schedule.staggerMs === undefined
            ? {}
            : { staggerMs: schedule.staggerMs }),
        },
      };
    case 'at':
      if (schedule.at === undefined) {
        return invalid('schedule.at is required for an at schedule');
      }
      // Steward carries absolute dates as Unix milliseconds; OpenClaw's
      // create/patch schema wants ISO text.
      return {
        ok: true,
        value: { kind: 'at', at: new Date(schedule.at).toISOString() },
      };
    case 'every':
      if (schedule.everyMs === undefined) {
        return invalid('schedule.everyMs is required for an every schedule');
      }
      return {
        ok: true,
        value: {
          kind: 'every',
          everyMs: schedule.everyMs,
          ...(schedule.anchorMs === undefined
            ? {}
            : { anchorMs: schedule.anchorMs }),
        },
      };
  }
}

function mapPayload(
  payload: NonNullable<StewardAutomationDispatchTask['payload']>
): MappingResult<CronPayload> {
  if (payload.kind === undefined) {
    return invalid('payload.kind is required');
  }
  if (payload.message === undefined) {
    return invalid('payload.message is required');
  }
  switch (payload.kind) {
    case 'systemEvent':
      return {
        ok: true,
        value: { kind: 'systemEvent', text: payload.message },
      };
    case 'agentTurn':
      return {
        ok: true,
        value: { kind: 'agentTurn', message: payload.message },
      };
    default:
      return invalid(
        `payload.kind must be "systemEvent" or "agentTurn", got "${payload.kind}"`
      );
  }
}

export interface StewardAutomationCronCreateInput {
  id: string;
  name: string;
  schedule: CronSchedule;
  sessionTarget: string;
  wakeMode: string;
  payload: CronPayload;
  agentId?: string;
  description?: string;
  enabled?: boolean;
}

export type StewardAutomationCronPatch = Partial<
  Omit<StewardAutomationCronCreateInput, 'id'>
>;

/** Map a create's task onto the gateway create schema, requiring what it requires. */
export function toStewardAutomationCronCreateInput(
  requestId: string,
  task: StewardAutomationDispatchTask
): MappingResult<StewardAutomationCronCreateInput> {
  if (task.name === undefined) {
    return invalid('name is required');
  }
  if (task.schedule === undefined) {
    return invalid('schedule is required');
  }
  if (task.sessionTarget === undefined) {
    return invalid('sessionTarget is required');
  }
  if (task.wakeMode === undefined) {
    return invalid('wakeMode is required');
  }
  if (task.payload === undefined) {
    return invalid('payload is required');
  }
  const schedule = mapSchedule(task.schedule);
  if (!schedule.ok) {
    return schedule;
  }
  const payload = mapPayload(task.payload);
  if (!payload.ok) {
    return payload;
  }
  return {
    ok: true,
    value: {
      id: deriveStewardAutomationJobId(requestId),
      name: task.name,
      schedule: schedule.value,
      sessionTarget: task.sessionTarget,
      wakeMode: task.wakeMode,
      payload: payload.value,
      ...(task.agentId === undefined ? {} : { agentId: task.agentId }),
      ...(task.description === undefined
        ? {}
        : { description: task.description }),
      ...(task.enabled === undefined ? {} : { enabled: task.enabled }),
    },
  };
}

/** Map an update's task onto a gateway patch carrying only the present fields. */
export function toStewardAutomationCronPatch(
  task: StewardAutomationDispatchTask
): MappingResult<StewardAutomationCronPatch> {
  const patch: StewardAutomationCronPatch = {
    ...(task.name === undefined ? {} : { name: task.name }),
    ...(task.agentId === undefined ? {} : { agentId: task.agentId }),
    ...(task.description === undefined
      ? {}
      : { description: task.description }),
    ...(task.enabled === undefined ? {} : { enabled: task.enabled }),
    ...(task.sessionTarget === undefined
      ? {}
      : { sessionTarget: task.sessionTarget }),
    ...(task.wakeMode === undefined ? {} : { wakeMode: task.wakeMode }),
  };
  if (task.schedule !== undefined) {
    const schedule = mapSchedule(task.schedule);
    if (!schedule.ok) {
      return schedule;
    }
    patch.schedule = schedule.value;
  }
  if (task.payload !== undefined) {
    const payload = mapPayload(task.payload);
    if (!payload.ok) {
      return payload;
    }
    patch.payload = payload.value;
  }
  if (Object.keys(patch).length === 0) {
    return invalid('an update must carry at least one field');
  }
  return { ok: true, value: patch };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isDuplicateJobError(error: unknown): boolean {
  return /already exists/i.test(errorMessage(error));
}

function isUnknownJobError(error: unknown): boolean {
  return /unknown cron job id/i.test(errorMessage(error));
}

function errorBody(
  errorType: StewardAutomationEditErrorType,
  message: string
): StewardAutomationResponseBody {
  return { type: 'error', errorType, message: message ? [message] : [] };
}

/** Apply one dispatch to the cron service and return the typed outcome. Never throws. */
export async function applyStewardAutomationDispatch(
  dispatch: StewardAutomationDispatch,
  cron: StewardAutomationCronWriteService
): Promise<StewardAutomationResponseBody> {
  const { action } = dispatch;

  if ('create' in action) {
    const input = toStewardAutomationCronCreateInput(
      dispatch.requestId,
      action.create
    );
    if (!input.ok) {
      return errorBody('invalid', input.message);
    }
    try {
      const result = await cron.add(input.value as never);
      return {
        type: 'created',
        id: resolveCreatedJobId(result) ?? input.value.id,
      };
    } catch (error) {
      if (isDuplicateJobError(error)) {
        // A replayed create: the job from the first attempt is the answer.
        return { type: 'created', id: input.value.id };
      }
      return errorBody('harness-error', errorMessage(error));
    }
  }

  if ('update' in action) {
    const { id, ...task } = action.update;
    const patch = toStewardAutomationCronPatch(task);
    if (!patch.ok) {
      return errorBody('invalid', patch.message);
    }
    try {
      await cron.update(id, patch.value as never);
      return { type: 'updated', id };
    } catch (error) {
      if (isUnknownJobError(error)) {
        return errorBody('not-found', errorMessage(error));
      }
      return errorBody('harness-error', errorMessage(error));
    }
  }

  const { id } = action.delete;
  try {
    const result = await cron.remove(id);
    if (result?.removed !== true) {
      return errorBody('not-found', `unknown cron job id: ${id}`);
    }
    return { type: 'deleted', id };
  } catch (error) {
    return errorBody('harness-error', errorMessage(error));
  }
}

export function buildStewardAutomationFinalize(
  requestId: string,
  body: StewardAutomationResponseBody
): StewardAutomationFinalizeAction {
  return { finalize: { requestId, body } };
}

export const DEFAULT_STEWARD_AUTOMATION_CRON_WAIT_MS = 1_000;
export const DEFAULT_STEWARD_AUTOMATION_CRON_WAIT_ATTEMPTS = 30;

export interface StewardAutomationEditProcessorOptions {
  poke: (params: {
    app: string;
    mark: string;
    json: unknown;
  }) => Promise<unknown>;
  /** The cron service, once a gateway hook has stashed it; undefined until then. */
  getCron: () => StewardAutomationCronWriteService | undefined;
  logger: {
    log?: (message: string) => void;
    warn: (message: string) => void;
  };
  cronWaitMs?: number;
  cronWaitAttempts?: number;
  wait?: (delayMs: number) => Promise<void>;
}

const defaultWait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, delayMs);
    timeout.unref?.();
  });

/**
 * Applies harness-feed dispatches one at a time and pokes `%finalize` for
 * each. Serialization means two edits to one job cannot race inside the
 * plugin; OpenClaw's store lock protects across processes.
 *
 * The harness feed and the gateway's cron service become available at about
 * the same time on startup, so a dispatch that arrives before `getCron` can
 * answer waits briefly instead of failing the edit.
 */
export class StewardAutomationEditProcessor {
  private queue: Promise<void> = Promise.resolve();
  private readonly cronWaitMs: number;
  private readonly cronWaitAttempts: number;
  private readonly wait: (delayMs: number) => Promise<void>;

  constructor(private readonly options: StewardAutomationEditProcessorOptions) {
    this.cronWaitMs =
      options.cronWaitMs ?? DEFAULT_STEWARD_AUTOMATION_CRON_WAIT_MS;
    this.cronWaitAttempts =
      options.cronWaitAttempts ?? DEFAULT_STEWARD_AUTOMATION_CRON_WAIT_ATTEMPTS;
    this.wait = options.wait ?? defaultWait;
  }

  /** Enqueue one harness-feed fact. Resolves when its finalize has been poked. */
  handle(data: unknown): Promise<void> {
    const run = this.queue.then(() => this.process(data));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async process(data: unknown): Promise<void> {
    let dispatch: StewardAutomationDispatch;
    try {
      dispatch = parseStewardAutomationDispatch(data);
    } catch (error) {
      if (
        error instanceof StewardAutomationDispatchError &&
        error.requestId !== null
      ) {
        this.options.logger.warn(
          `[tlon] Steward automation dispatch ${error.requestId} rejected: ${error.message}`
        );
        await this.finalize(
          error.requestId,
          errorBody('invalid', error.message)
        );
        return;
      }
      // Without a request id there is nothing to answer; the bot's sweep
      // eventually drops the pending record.
      this.options.logger.warn(
        `[tlon] Steward automation dispatch ignored: ${errorMessage(error)}`
      );
      return;
    }

    const cron = await this.waitForCron();
    if (!cron) {
      await this.finalize(
        dispatch.requestId,
        errorBody(
          'harness-error',
          'the gateway cron service is unavailable to this plugin'
        )
      );
      return;
    }

    const body = await applyStewardAutomationDispatch(dispatch, cron);
    this.options.logger.log?.(
      `[tlon] Steward automation dispatch ${dispatch.requestId}: ${body.type}` +
        (body.type === 'error' ? ` (${body.errorType})` : ` ${body.id}`)
    );
    await this.finalize(dispatch.requestId, body);
  }

  private async waitForCron(): Promise<
    StewardAutomationCronWriteService | undefined
  > {
    for (let attempt = 0; ; attempt += 1) {
      const cron = this.options.getCron();
      if (cron) {
        return cron;
      }
      if (attempt >= this.cronWaitAttempts) {
        return undefined;
      }
      await this.wait(this.cronWaitMs);
    }
  }

  private async finalize(
    requestId: string,
    body: StewardAutomationResponseBody
  ): Promise<void> {
    try {
      await this.options.poke({
        app: 'steward',
        mark: STEWARD_AUTOMATION_ACTION_MARK,
        json: buildStewardAutomationFinalize(requestId, body),
      });
    } catch (error) {
      // The bot keeps the command pending and replays it when we resubscribe,
      // so a lost finalize is recovered by the next delivery, and a replayed
      // create is idempotent under its derived id.
      this.options.logger.warn(
        `[tlon] Steward automation finalize for ${requestId} failed: ${errorMessage(error)}`
      );
    }
  }
}
