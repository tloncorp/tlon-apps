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

/** Create once, then prove the scheduler can list the stored job. */
export async function ensureDeterministicCronJob(params: {
  nest: string;
  purposeId: string;
  topics: string;
  timezone: string;
}): Promise<string> {
  const template = PURPOSE_JOBS[params.purposeId];
  if (!template) {
    throw new Error(`Unknown onboarding purpose: ${params.purposeId}`);
  }
  let cron = getCronService();
  for (const delay of [250, 750, 1_500]) {
    if (cron) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    cron = getCronService();
  }
  if (!cron) {
    throw new Error('OpenClaw cron service is unavailable');
  }
  const description = cronDescription(params.nest, params.purposeId);
  const existing = (await cron.list({ includeDisabled: true })).find((job) =>
    cronJobMatches(job, description)
  );
  if (existing?.id) {
    return existing.id;
  }

  let addError: unknown;
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
  } catch (error) {
    // Treat the add result as ambiguous until list proves otherwise. The
    // scheduler may have persisted the job before its response was lost.
    addError = error;
  }

  for (const delay of [0, 250, 1_000, 2_000]) {
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const stored = (await cron.list({ includeDisabled: true })).find((job) =>
      cronJobMatches(job, description)
    );
    if (stored?.id) {
      return stored.id;
    }
  }
  throw new Error(
    `The scheduled job could not be verified${addError ? `: ${String(addError)}` : ''}`
  );
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
