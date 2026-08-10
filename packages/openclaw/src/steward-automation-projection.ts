import type { PluginHookGatewayCronJob } from 'openclaw/plugin-sdk/types';

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

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, field: string): UnknownRecord {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${field}: expected an object`);
  }
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${field}: expected a string`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requiredString(value, field);
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${field}: expected a boolean`);
  }
  return value;
}

function optionalNaturalNumber(
  value: unknown,
  field: string
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${field}: expected a non-negative safe integer`);
  }
  return value;
}

function optionalIsoTimestamp(
  value: unknown,
  field: string
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const timestamp = requiredString(value, field);
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      timestamp
    );
  const milliseconds = Date.parse(timestamp);
  if (!parts || !Number.isSafeInteger(milliseconds) || milliseconds < 0) {
    throw new Error(`Invalid ${field}: expected an ISO timestamp`);
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const validCalendarDate =
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= new Date(Date.UTC(year, month, 0)).getUTCDate() &&
    Number(hourText) <= 23 &&
    Number(minuteText) <= 59 &&
    Number(secondText) <= 59 &&
    (parts[7] === undefined || Number(parts[7]) <= 23) &&
    (parts[8] === undefined || Number(parts[8]) <= 59);
  if (!validCalendarDate) {
    throw new Error(`Invalid ${field}: expected an ISO timestamp`);
  }
  return milliseconds;
}

function normalizeSchedule(
  value: unknown,
  jobId: string
): StewardAutomationSchedule | undefined {
  if (value === undefined) {
    return undefined;
  }
  const schedule = requireRecord(value, `cron job ${jobId} schedule`);
  const field = (name: string) => `cron job ${jobId} schedule.${name}`;

  switch (schedule.kind) {
    case 'cron': {
      const expr = optionalString(schedule.expr, field('expr'));
      const tz = optionalString(schedule.tz, field('tz'));
      const staggerMs = optionalNaturalNumber(
        schedule.staggerMs,
        field('staggerMs')
      );
      return {
        kind: 'cron',
        ...(expr === undefined ? {} : { expr }),
        ...(tz === undefined ? {} : { tz }),
        ...(staggerMs === undefined ? {} : { staggerMs }),
      };
    }
    case 'at': {
      const at = optionalIsoTimestamp(schedule.at, field('at'));
      return {
        kind: 'at',
        ...(at === undefined ? {} : { at }),
      };
    }
    case 'every': {
      const everyMs = optionalNaturalNumber(schedule.everyMs, field('everyMs'));
      const anchorMs = optionalNaturalNumber(
        schedule.anchorMs,
        field('anchorMs')
      );
      return {
        kind: 'every',
        ...(everyMs === undefined ? {} : { everyMs }),
        ...(anchorMs === undefined ? {} : { anchorMs }),
      };
    }
    default:
      throw new Error(
        `Invalid cron job ${jobId} schedule.kind: unsupported value ${String(schedule.kind)}`
      );
  }
}

function normalizePayload(
  value: unknown,
  jobId: string
): StewardAutomationPayload | undefined {
  if (value === undefined) {
    return undefined;
  }
  const payload = requireRecord(value, `cron job ${jobId} payload`);
  const kind = optionalString(payload.kind, `cron job ${jobId} payload.kind`);
  // The pinned declaration says `text`; captured 2026.5.28 runtime values use
  // `message`. Validate both aliases and expose only Steward's `text`.
  const declaredText = optionalString(
    payload.text,
    `cron job ${jobId} payload.text`
  );
  const runtimeMessage = optionalString(
    payload.message,
    `cron job ${jobId} payload.message`
  );
  const text = declaredText ?? runtimeMessage;
  return {
    ...(kind === undefined ? {} : { kind }),
    ...(text === undefined ? {} : { text }),
  };
}

function normalizeTask(job: PluginHookGatewayCronJob): StewardAutomationTask {
  const source = requireRecord(job, 'cron job');
  const id = requiredString(source.id, 'cron job id');
  const field = (name: string) => `cron job ${id} ${name}`;
  const agentId = optionalString(source.agentId, field('agentId'));
  const name = optionalString(source.name, field('name'));
  const description = optionalString(source.description, field('description'));
  const enabled = optionalBoolean(source.enabled, field('enabled'));
  const schedule = normalizeSchedule(source.schedule, id);
  const sessionTarget = optionalString(
    source.sessionTarget,
    field('sessionTarget')
  );
  const wakeMode = optionalString(source.wakeMode, field('wakeMode'));
  const payload = normalizePayload(source.payload, id);
  const createdAtMs = optionalNaturalNumber(
    source.createdAtMs,
    field('createdAtMs')
  );
  const updatedAtMs = optionalNaturalNumber(
    source.updatedAtMs,
    field('updatedAtMs')
  );

  return {
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
  };
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
