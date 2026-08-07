import type { PluginHookGatewayCronJob } from 'openclaw/plugin-sdk/types';

import { getCronService } from '../cron-telemetry.js';
import { PURPOSE_JOBS, PURPOSE_OPTIONS } from './agent-onboarding-config.js';

export const ONBOARDING_TIMEZONE_PREFIX = 'Timezone:';

export type DeterministicOnboardingState =
  | 'awaiting-topics'
  | 'awaiting-timezone'
  | 'awaiting-notebook'
  | 'researching'
  | 'writing-note'
  | 'complete';

export type DeterministicOnboardingRecord = {
  state: DeterministicOnboardingState;
  topics: string;
  timezone?: string;
  cronJobId?: string;
  notebookNest?: string;
  noteBaseline?: string | null;
  noteId?: string;
};

export type DeterministicSetup = {
  purposeId: string;
  topics: string;
  timezone: string;
  agentShip: string;
  record: DeterministicOnboardingRecord;
};

const CONFIG_TYPE = 'tlon-group-agent-config';

const fill = (template: string, topics: string) =>
  template.replaceAll('{{topics}}', topics);

export function normalizeIanaTimezone(value: string): string | null {
  const candidate = value
    .trim()
    .replace(new RegExp(`^${ONBOARDING_TIMEZONE_PREFIX}\\s*`, 'i'), '');
  if (!candidate || candidate.length > 100) {
    return null;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format();
    return candidate;
  } catch {
    return null;
  }
}

export function buildDeterministicSetupDescription(
  setup: DeterministicSetup
): string {
  const job = PURPOSE_JOBS[setup.purposeId];
  if (!job) {
    throw new Error(`Unknown onboarding purpose: ${setup.purposeId}`);
  }
  const option = PURPOSE_OPTIONS.find(({ id }) => id === setup.purposeId);
  const jobs = setup.record.cronJobId
    ? [
        {
          id: setup.purposeId,
          cronJobId: setup.record.cronJobId,
          title: fill(job.title, setup.topics),
          schedule: {
            kind: 'cron',
            expr: job.schedule,
            tz: setup.timezone,
          },
          prompt: fill(job.prompt, setup.topics),
          outputNest:
            setup.record.state === 'complete'
              ? setup.record.notebookNest ?? ''
              : '',
          enabled: true,
        },
      ]
    : [];
  return JSON.stringify([
    {
      type: CONFIG_TYPE,
      version: 1,
      templateId: setup.purposeId,
      purpose: option?.description ?? fill(job.title, setup.topics),
      instructions: '',
      agents: [setup.agentShip],
      jobs,
      onboarding: setup.record,
      updatedAt: Date.now(),
    },
  ]);
}

export function buildAwaitingTimezoneDescription(params: {
  purposeId: string;
  topics: string;
  agentShip: string;
}): string {
  return buildDeterministicSetupDescription({
    purposeId: params.purposeId,
    topics: params.topics,
    timezone: '',
    agentShip: params.agentShip,
    record: {
      state: 'awaiting-timezone',
      topics: params.topics,
    },
  });
}

export function buildAwaitingTopicsDescription(params: {
  purposeId: string;
  agentShip: string;
}): string {
  return buildDeterministicSetupDescription({
    purposeId: params.purposeId,
    topics: '',
    timezone: '',
    agentShip: params.agentShip,
    record: {
      state: 'awaiting-topics',
      topics: '',
    },
  });
}

export function deterministicSetupFromDescription(
  description: string | null | undefined
): DeterministicSetup | null {
  if (!description?.trim().startsWith('[')) {
    return null;
  }
  try {
    const entries = JSON.parse(description) as unknown;
    if (!Array.isArray(entries)) {
      return null;
    }
    const entry = entries.find(
      (candidate) =>
        candidate &&
        typeof candidate === 'object' &&
        (candidate as { type?: unknown }).type === CONFIG_TYPE &&
        (candidate as { version?: unknown }).version === 1
    ) as
      | {
          templateId?: unknown;
          agents?: unknown;
          onboarding?: unknown;
        }
      | undefined;
    if (!entry || typeof entry.templateId !== 'string') {
      return null;
    }
    const record = entry.onboarding as Partial<DeterministicOnboardingRecord>;
    const agentShip = Array.isArray(entry.agents)
      ? entry.agents.find((agent): agent is string => typeof agent === 'string')
      : undefined;
    if (
      !record ||
      typeof record.state !== 'string' ||
      typeof record.topics !== 'string' ||
      !agentShip ||
      !PURPOSE_JOBS[entry.templateId]
    ) {
      return null;
    }
    return {
      purposeId: entry.templateId,
      topics: record.topics,
      timezone: record.timezone ?? '',
      agentShip,
      record: record as DeterministicOnboardingRecord,
    };
  } catch {
    return null;
  }
}

function cronDescription(nest: string, purposeId: string): string {
  return `tlon-agent-onboarding:${nest}:${purposeId}`;
}

function cronJobMatches(
  job: PluginHookGatewayCronJob,
  description: string
): job is PluginHookGatewayCronJob & { id: string } {
  return job.description === description && typeof job.id === 'string';
}

export type DeterministicCronTraceEvent = {
  operation: string;
  outcome: string;
  attempt?: number;
  retryDelayMs?: number;
  durationMs?: number;
  cronJobId?: string;
  totalCronJobCount?: number;
  error?: unknown;
};

export type DeterministicCronTracer = (
  event: DeterministicCronTraceEvent
) => void;

/** Create once, then prove the scheduler can list the stored job. */
export async function ensureDeterministicCronJob(params: {
  nest: string;
  purposeId: string;
  topics: string;
  timezone: string;
  trace?: DeterministicCronTracer;
}): Promise<string> {
  const trace = params.trace;
  const startedAt = Date.now();
  trace?.({ operation: 'resolve_service', outcome: 'started' });
  const template = PURPOSE_JOBS[params.purposeId];
  if (!template) {
    trace?.({
      operation: 'resolve_template',
      outcome: 'failed',
      durationMs: Date.now() - startedAt,
      error: new Error(`Unknown onboarding purpose: ${params.purposeId}`),
    });
    throw new Error(`Unknown onboarding purpose: ${params.purposeId}`);
  }
  let cron = getCronService();
  let serviceAttempt = 0;
  for (const delay of [250, 750, 1_500]) {
    if (cron) {
      break;
    }
    serviceAttempt += 1;
    trace?.({
      operation: 'resolve_service',
      outcome: 'retrying',
      attempt: serviceAttempt,
      retryDelayMs: delay,
      durationMs: Date.now() - startedAt,
    });
    await new Promise((resolve) => setTimeout(resolve, delay));
    cron = getCronService();
  }
  if (!cron) {
    trace?.({
      operation: 'resolve_service',
      outcome: 'failed',
      attempt: serviceAttempt,
      durationMs: Date.now() - startedAt,
      error: new Error('OpenClaw cron service is unavailable'),
    });
    throw new Error('OpenClaw cron service is unavailable');
  }
  trace?.({
    operation: 'resolve_service',
    outcome: 'succeeded',
    attempt: serviceAttempt,
    durationMs: Date.now() - startedAt,
  });
  const description = cronDescription(params.nest, params.purposeId);
  const initialListStartedAt = Date.now();
  trace?.({ operation: 'list_existing', outcome: 'started' });
  let initialJobs: PluginHookGatewayCronJob[];
  try {
    initialJobs = await cron.list({ includeDisabled: true });
    trace?.({
      operation: 'list_existing',
      outcome: 'succeeded',
      durationMs: Date.now() - initialListStartedAt,
      totalCronJobCount: initialJobs.length,
    });
  } catch (error) {
    trace?.({
      operation: 'list_existing',
      outcome: 'failed',
      durationMs: Date.now() - initialListStartedAt,
      error,
    });
    throw error;
  }
  const existing = initialJobs.find((job) => cronJobMatches(job, description));
  if (existing?.id) {
    trace?.({
      operation: 'reuse_existing',
      outcome: 'succeeded',
      durationMs: Date.now() - startedAt,
      cronJobId: existing.id,
      totalCronJobCount: initialJobs.length,
    });
    return existing.id;
  }

  let addError: unknown;
  const addStartedAt = Date.now();
  trace?.({ operation: 'add_job', outcome: 'started' });
  try {
    await cron.add({
      name: fill(template.title, params.topics),
      description,
      enabled: true,
      schedule: {
        kind: 'cron',
        expr: template.schedule,
        tz: params.timezone,
      },
      sessionTarget: 'isolated',
      wakeMode: 'now',
      payload: {
        kind: 'agentTurn',
        text: fill(template.prompt, params.topics),
      },
    });
    trace?.({
      operation: 'add_job',
      outcome: 'succeeded',
      durationMs: Date.now() - addStartedAt,
    });
  } catch (error) {
    // Treat the add result as ambiguous until list proves otherwise. The
    // scheduler may have persisted the job before its response was lost.
    addError = error;
    trace?.({
      operation: 'add_job',
      outcome: 'failed_ambiguous',
      durationMs: Date.now() - addStartedAt,
      error,
    });
  }

  let verifyAttempt = 0;
  for (const delay of [0, 250, 1_000, 2_000]) {
    verifyAttempt += 1;
    if (delay) {
      trace?.({
        operation: 'verify_job',
        outcome: 'retrying',
        attempt: verifyAttempt,
        retryDelayMs: delay,
        durationMs: Date.now() - startedAt,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const verifyStartedAt = Date.now();
    trace?.({
      operation: 'verify_job',
      outcome: 'started',
      attempt: verifyAttempt,
    });
    let jobs: PluginHookGatewayCronJob[];
    try {
      jobs = await cron.list({ includeDisabled: true });
    } catch (error) {
      trace?.({
        operation: 'verify_job',
        outcome: 'failed',
        attempt: verifyAttempt,
        durationMs: Date.now() - verifyStartedAt,
        error,
      });
      throw error;
    }
    const stored = jobs.find((job) => cronJobMatches(job, description));
    if (stored?.id) {
      trace?.({
        operation: 'verify_job',
        outcome: 'succeeded',
        attempt: verifyAttempt,
        durationMs: Date.now() - verifyStartedAt,
        cronJobId: stored.id,
        totalCronJobCount: jobs.length,
      });
      return stored.id;
    }
    trace?.({
      operation: 'verify_job',
      outcome: 'missing',
      attempt: verifyAttempt,
      durationMs: Date.now() - verifyStartedAt,
      totalCronJobCount: jobs.length,
    });
  }
  const finalError = new Error(
    `The scheduled job could not be verified${addError ? `: ${String(addError)}` : ''}`
  );
  trace?.({
    operation: 'ensure_job',
    outcome: 'failed',
    attempt: verifyAttempt,
    durationMs: Date.now() - startedAt,
    error: finalError,
  });
  throw finalError;
}

export function renderDeterministicResearchDirective(params: {
  nest: string;
  purposeId: string;
  topics: string;
}): string {
  const template = PURPOSE_JOBS[params.purposeId];
  if (!template) {
    throw new Error(`Unknown onboarding purpose: ${params.purposeId}`);
  }
  return [
    '[Tlon onboarding research directive — not written by the owner]',
    `Research the first notebook entry for: ${params.topics}.`,
    `Content requirements: ${fill(template.entry, params.topics)}`,
    'Use web search whenever the content calls for current information.',
    'Do not create or update a group, channel, cron job, config, notebook,',
    'note, title, or icon. Do not send a chat message. The deterministic Tlon',
    'coordinator owns every side effect. Your only final action is one call',
    'to `tlon_onboarding_draft` with the exact nest below, a concise title,',
    'and the complete Markdown entry including source links where relevant.',
    `nest: ${params.nest}`,
  ].join(' ');
}
