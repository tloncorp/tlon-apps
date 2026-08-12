import type {
  PluginHookGatewayCronCreateInput,
  PluginHookGatewayCronJob,
  PluginHookGatewayCronUpdateInput,
} from 'openclaw/plugin-sdk/types';

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
  purpose?: string;
  topics: string;
  timezone: string;
  agentShip: string;
  record: DeterministicOnboardingRecord;
};

export type DeterministicResearchDraft = {
  title: string;
  markdown: string;
};

export type OnboardingSequenceBlocker =
  | 'purpose_missing'
  | 'topics_missing'
  | 'timezone_missing_or_invalid'
  | 'cron_job_missing'
  | 'notebook_missing'
  | 'note_missing'
  | `state_${DeterministicOnboardingState}_not_ready`;

export type OnboardingWriteQueue = {
  has: (key: string) => boolean;
  run: <T>(key: string, operation: () => Promise<T>) => Promise<T>;
};

/**
 * Serialize whole-description writes for a group. The Tlon CLI can time out
 * after the poke has landed, so allowing a newer state transition to write in
 * parallel lets an older retry overwrite it later.
 */
export function createOnboardingWriteQueue(): OnboardingWriteQueue {
  const tails = new Map<string, Promise<void>>();

  return {
    has: (key) => tails.has(key),
    run: async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
      const previous = tails.get(key) ?? Promise.resolve();
      const result = previous.then(operation);
      const tail = result.then(
        () => undefined,
        () => undefined
      );
      tails.set(key, tail);

      try {
        return await result;
      } finally {
        if (tails.get(key) === tail) {
          tails.delete(key);
        }
      }
    },
  };
}

const CONFIG_TYPE = 'tlon-group-agent-config';

const fill = (template: string, topics: string, purpose = '') =>
  template.replaceAll('{{topics}}', topics).replaceAll('{{purpose}}', purpose);

const OUTPUT_NEST_MARKER = 'Configured notebook output nest:';

/** Render the recurring prompt with a durable notebook destination once known. */
export function renderDeterministicCronPrompt(params: {
  purposeId: string;
  purpose?: string;
  topics: string;
  outputNest?: string | null;
}): string {
  const template = PURPOSE_JOBS[params.purposeId];
  if (!template) {
    throw new Error(`Unknown onboarding purpose: ${params.purposeId}`);
  }
  const prompt = `${fill(template.prompt, params.topics, params.purpose)}\nAfter the note-create (or chat fallback) succeeds, return exactly: Scheduled update complete.`;
  const outputNest = params.outputNest?.trim();
  return outputNest
    ? `${prompt}\n\n${OUTPUT_NEST_MARKER} ${outputNest}\nUse this exact nest for every note-create command.`
    : prompt;
}

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

export function parseDeterministicResearchDraft(
  output: string
): DeterministicResearchDraft {
  const trimmed = output.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  let parsed: unknown;
  try {
    parsed = JSON.parse(fenced?.[1] ?? trimmed);
  } catch {
    throw new Error('The research agent returned invalid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The research agent did not return a draft object');
  }
  const title =
    typeof (parsed as { title?: unknown }).title === 'string'
      ? (parsed as { title: string }).title.trim()
      : '';
  const markdown =
    typeof (parsed as { markdown?: unknown }).markdown === 'string'
      ? (parsed as { markdown: string }).markdown.trim()
      : '';
  if (!title || title.length > 200) {
    throw new Error('The draft title must be between 1 and 200 characters');
  }
  if (!markdown || markdown.length > 50_000) {
    throw new Error(
      'The Markdown draft must be between 1 and 50,000 characters'
    );
  }
  return { title, markdown };
}

/**
 * Persisted prerequisites for provisioning the notebook and starting research.
 * In-memory pending flags are deliberately not enough: restart reconciliation
 * must never skip over a partially written purpose/topics/timezone transition.
 */
export function onboardingResearchSequenceBlocker(
  setup: DeterministicSetup
): OnboardingSequenceBlocker | null {
  if (
    setup.record.state !== 'awaiting-notebook' &&
    setup.record.state !== 'researching' &&
    setup.record.state !== 'writing-note'
  ) {
    return `state_${setup.record.state}_not_ready`;
  }
  if (!setup.purposeId.trim()) {
    return 'purpose_missing';
  }
  if (!setup.topics.trim()) {
    return 'topics_missing';
  }
  if (!setup.timezone || !normalizeIanaTimezone(setup.timezone)) {
    return 'timezone_missing_or_invalid';
  }
  if (!setup.record.cronJobId?.trim()) {
    return 'cron_job_missing';
  }
  return null;
}

/** Closing cards are allowed only after the note's durable identity is saved. */
export function onboardingCompletionSequenceBlocker(
  setup: DeterministicSetup
): OnboardingSequenceBlocker | null {
  const researchBlocker = onboardingResearchSequenceBlocker({
    ...setup,
    record: { ...setup.record, state: 'writing-note' },
  });
  if (researchBlocker) {
    return researchBlocker;
  }
  if (setup.record.state !== 'complete') {
    return `state_${setup.record.state}_not_ready`;
  }
  if (!setup.record.notebookNest?.trim()) {
    return 'notebook_missing';
  }
  if (!setup.record.noteId?.trim()) {
    return 'note_missing';
  }
  return null;
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
          title: fill(job.title, setup.topics, setup.purpose),
          schedule: {
            kind: 'cron',
            expr: job.schedule,
            tz: setup.timezone,
          },
          prompt: renderDeterministicCronPrompt({
            purposeId: setup.purposeId,
            purpose: setup.purpose,
            topics: setup.topics,
            outputNest:
              setup.record.state === 'complete'
                ? setup.record.notebookNest
                : null,
          }),
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
      purpose:
        setup.purpose?.trim() ||
        option?.description ||
        fill(job.title, setup.topics),
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
  purpose?: string;
  topics: string;
  agentShip: string;
}): string {
  return buildDeterministicSetupDescription({
    purposeId: params.purposeId,
    purpose: params.purpose,
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
  purpose?: string;
  agentShip: string;
}): string {
  return buildDeterministicSetupDescription({
    purposeId: params.purposeId,
    purpose: params.purpose,
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
          purpose?: unknown;
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
      purpose: typeof entry.purpose === 'string' ? entry.purpose : undefined,
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

function cronOutputNest(job: PluginHookGatewayCronJob): string | undefined {
  const match = cronPrompt(job).match(
    new RegExp(`${OUTPUT_NEST_MARKER}\\s+([^\\s]+)`)
  );
  return match?.[1];
}

function cronJobMatchesDesired(
  job: PluginHookGatewayCronJob,
  desired: PluginHookGatewayCronCreateInput
): boolean {
  const schedule = job.schedule as
    | { kind?: string; expr?: string; tz?: string }
    | undefined;
  const desiredSchedule = desired.schedule as {
    kind?: string;
    expr?: string;
    tz?: string;
  };
  return (
    job.name === desired.name &&
    job.enabled === true &&
    schedule?.kind === desiredSchedule.kind &&
    schedule?.expr === desiredSchedule.expr &&
    schedule?.tz === desiredSchedule.tz &&
    job.sessionTarget === desired.sessionTarget &&
    job.wakeMode === desired.wakeMode &&
    cronPrompt(job) === cronPrompt(desired as PluginHookGatewayCronJob) &&
    hasNotebookOnlyDelivery(job)
  );
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
  purpose?: string;
  topics: string;
  timezone: string;
  abortSignal?: AbortSignal;
  trace?: DeterministicCronTracer;
}): Promise<string> {
  const trace = params.trace;
  const emit = (
    operation: string,
    outcome: string,
    details: Partial<
      Omit<DeterministicCronTraceEvent, 'operation' | 'outcome'>
    > = {}
  ) => trace?.({ operation, outcome, ...details });
  const assertActive = () => {
    if (params.abortSignal?.aborted) {
      throw new Error('Onboarding cron setup aborted with monitor');
    }
  };
  const startedAt = Date.now();
  assertActive();
  emit('resolve_service', 'started');
  const template = PURPOSE_JOBS[params.purposeId];
  if (!template) {
    emit('resolve_template', 'failed', {
      durationMs: Date.now() - startedAt,
      error: new Error(`Unknown onboarding purpose: ${params.purposeId}`),
    });
    throw new Error(`Unknown onboarding purpose: ${params.purposeId}`);
  }
  let cron = getCronService();
  let serviceAttempt = 0;
  for (const delay of [250, 750, 1_500]) {
    assertActive();
    if (cron) {
      break;
    }
    serviceAttempt += 1;
    emit('resolve_service', 'retrying', {
      attempt: serviceAttempt,
      retryDelayMs: delay,
      durationMs: Date.now() - startedAt,
    });
    await new Promise((resolve) => setTimeout(resolve, delay));
    assertActive();
    cron = getCronService();
  }
  if (!cron) {
    emit('resolve_service', 'failed', {
      attempt: serviceAttempt,
      durationMs: Date.now() - startedAt,
      error: new Error('OpenClaw cron service is unavailable'),
    });
    throw new Error('OpenClaw cron service is unavailable');
  }
  emit('resolve_service', 'succeeded', {
    attempt: serviceAttempt,
    durationMs: Date.now() - startedAt,
  });
  const description = cronDescription(params.nest, params.purposeId);
  const basePrompt = renderDeterministicCronPrompt({
    purposeId: params.purposeId,
    purpose: params.purpose,
    topics: params.topics,
  });
  const desiredInput = (
    outputNest?: string
  ): PluginHookGatewayCronCreateInput => {
    const prompt = outputNest
      ? renderDeterministicCronPrompt({
          purposeId: params.purposeId,
          purpose: params.purpose,
          topics: params.topics,
          outputNest,
        })
      : basePrompt;
    return {
      name: fill(template.title, params.topics, params.purpose),
      description,
      enabled: true,
      schedule: {
        kind: 'cron',
        expr: template.schedule,
        tz: params.timezone,
      },
      sessionTarget: 'isolated',
      wakeMode: 'now',
      payload: { kind: 'agentTurn', text: prompt, message: prompt },
      delivery: { mode: 'none' },
    } as PluginHookGatewayCronCreateInput;
  };
  const initialListStartedAt = Date.now();
  emit('list_existing', 'started');
  let initialJobs: PluginHookGatewayCronJob[];
  try {
    assertActive();
    initialJobs = await cron.list({ includeDisabled: true });
    emit('list_existing', 'succeeded', {
      durationMs: Date.now() - initialListStartedAt,
      totalCronJobCount: initialJobs.length,
    });
  } catch (error) {
    emit('list_existing', 'failed', {
      durationMs: Date.now() - initialListStartedAt,
      error,
    });
    throw error;
  }
  const existing = initialJobs.find((job) => cronJobMatches(job, description));
  if (existing?.id) {
    const desired = desiredInput(cronOutputNest(existing));
    if (!cronJobMatchesDesired(existing, desired)) {
      assertActive();
      emit('update_existing', 'started', { cronJobId: existing.id });
      await cron.update(
        existing.id,
        desired as PluginHookGatewayCronUpdateInput
      );
      assertActive();
      const updated = (await cron.list({ includeDisabled: true })).find(
        (job) => job.id === existing.id
      );
      if (!updated || !cronJobMatchesDesired(updated, desired)) {
        throw new Error(`The scheduled job update could not be verified`);
      }
      emit('update_existing', 'succeeded', {
        cronJobId: existing.id,
        durationMs: Date.now() - startedAt,
      });
    }
    emit('reuse_existing', 'succeeded', {
      durationMs: Date.now() - startedAt,
      cronJobId: existing.id,
      totalCronJobCount: initialJobs.length,
    });
    return existing.id;
  }

  let addError: unknown;
  const addStartedAt = Date.now();
  emit('add_job', 'started');
  try {
    assertActive();
    await cron.add(desiredInput());
    emit('add_job', 'succeeded', {
      durationMs: Date.now() - addStartedAt,
    });
  } catch (error) {
    // Treat the add result as ambiguous until list proves otherwise. The
    // scheduler may have persisted the job before its response was lost.
    addError = error;
    emit('add_job', 'failed_ambiguous', {
      durationMs: Date.now() - addStartedAt,
      error,
    });
  }

  let verifyAttempt = 0;
  for (const delay of [0, 250, 1_000, 2_000]) {
    assertActive();
    verifyAttempt += 1;
    if (delay) {
      emit('verify_job', 'retrying', {
        attempt: verifyAttempt,
        retryDelayMs: delay,
        durationMs: Date.now() - startedAt,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
      assertActive();
    }
    const verifyStartedAt = Date.now();
    emit('verify_job', 'started', {
      attempt: verifyAttempt,
    });
    let jobs: PluginHookGatewayCronJob[];
    try {
      assertActive();
      jobs = await cron.list({ includeDisabled: true });
    } catch (error) {
      emit('verify_job', 'failed', {
        attempt: verifyAttempt,
        durationMs: Date.now() - verifyStartedAt,
        error,
      });
      throw error;
    }
    const stored = jobs.find((job) => cronJobMatches(job, description));
    if (stored?.id) {
      emit('verify_job', 'succeeded', {
        attempt: verifyAttempt,
        durationMs: Date.now() - verifyStartedAt,
        cronJobId: stored.id,
        totalCronJobCount: jobs.length,
      });
      return stored.id;
    }
    emit('verify_job', 'missing', {
      attempt: verifyAttempt,
      durationMs: Date.now() - verifyStartedAt,
      totalCronJobCount: jobs.length,
    });
  }
  const finalError = new Error(
    `The scheduled job could not be verified${addError ? `: ${String(addError)}` : ''}`
  );
  emit('ensure_job', 'failed', {
    attempt: verifyAttempt,
    durationMs: Date.now() - startedAt,
    error: finalError,
  });
  throw finalError;
}

type CronPayloadWithMessage = NonNullable<
  PluginHookGatewayCronJob['payload']
> & {
  message?: string;
};

type CronJobWithDelivery = PluginHookGatewayCronJob & {
  delivery?: { mode?: string };
};

function cronPrompt(job: PluginHookGatewayCronJob): string {
  const payload = job.payload as CronPayloadWithMessage | undefined;
  return payload?.message ?? payload?.text ?? '';
}

function hasNotebookOnlyDelivery(job: PluginHookGatewayCronJob): boolean {
  return (job as CronJobWithDelivery).delivery?.mode === 'none';
}

/**
 * Persist the notebook destination in the recurring prompt after the client
 * creates the notebook. OpenClaw's cron schema does not retain arbitrary job
 * fields, so embedding the exact nest in the stored prompt is the durable
 * equivalent of the declarative config's `outputNest` field.
 */
export async function ensureDeterministicCronOutputNest(params: {
  cronJobId: string;
  purposeId: string;
  purpose?: string;
  topics: string;
  outputNest: string;
  abortSignal?: AbortSignal;
  trace?: DeterministicCronTracer;
}): Promise<void> {
  const startedAt = Date.now();
  const trace = params.trace;
  const emit = (
    operation: string,
    outcome: string,
    details: Partial<
      Omit<DeterministicCronTraceEvent, 'operation' | 'outcome'>
    > = {}
  ) => trace?.({ operation, outcome, ...details });
  const assertActive = () => {
    if (params.abortSignal?.aborted) {
      throw new Error('Onboarding cron output repair aborted with monitor');
    }
  };
  assertActive();
  const outputNest = params.outputNest.trim();
  if (!outputNest) {
    throw new Error('The onboarding notebook nest is empty');
  }
  const cron = getCronService();
  if (!cron) {
    throw new Error('OpenClaw cron service is unavailable');
  }
  const prompt = renderDeterministicCronPrompt({
    purposeId: params.purposeId,
    purpose: params.purpose,
    topics: params.topics,
    outputNest,
  });

  emit('list_output_job', 'started');
  assertActive();
  let jobs = await cron.list({ includeDisabled: true });
  const existing = jobs.find((job) => job.id === params.cronJobId);
  if (!existing) {
    throw new Error(`The onboarding cron job is missing: ${params.cronJobId}`);
  }
  if (cronPrompt(existing) === prompt && hasNotebookOnlyDelivery(existing)) {
    emit('reuse_output_nest', 'succeeded', {
      cronJobId: params.cronJobId,
      durationMs: Date.now() - startedAt,
    });
    return;
  }

  const payload = {
    kind: existing.payload?.kind ?? 'agentTurn',
    text: prompt,
    message: prompt,
  };
  emit('update_output_nest', 'started', { cronJobId: params.cronJobId });
  try {
    assertActive();
    await cron.update(params.cronJobId, {
      payload,
      delivery: { mode: 'none' },
    } as PluginHookGatewayCronUpdateInput);
    emit('update_output_nest', 'succeeded', {
      cronJobId: params.cronJobId,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    // The update response can be lost after persistence, so list is the source
    // of truth below rather than treating this error as final.
    emit('update_output_nest', 'failed_ambiguous', {
      cronJobId: params.cronJobId,
      durationMs: Date.now() - startedAt,
      error,
    });
  }

  let attempt = 0;
  for (const delay of [0, 250, 1_000, 2_000]) {
    assertActive();
    attempt += 1;
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      assertActive();
    }
    emit('verify_output_nest', 'started', {
      attempt,
      cronJobId: params.cronJobId,
    });
    assertActive();
    jobs = await cron.list({ includeDisabled: true });
    const stored = jobs.find((job) => job.id === params.cronJobId);
    if (
      stored &&
      cronPrompt(stored) === prompt &&
      hasNotebookOnlyDelivery(stored)
    ) {
      emit('verify_output_nest', 'succeeded', {
        attempt,
        cronJobId: params.cronJobId,
        durationMs: Date.now() - startedAt,
      });
      return;
    }
    emit('verify_output_nest', 'missing', {
      attempt,
      cronJobId: params.cronJobId,
      durationMs: Date.now() - startedAt,
    });
  }
  throw new Error(
    `The onboarding cron output nest could not be verified: ${params.cronJobId}`
  );
}

export function renderDeterministicResearchDirective(params: {
  nest: string;
  purposeId: string;
  purpose?: string;
  topics: string;
}): string {
  const template = PURPOSE_JOBS[params.purposeId];
  if (!template) {
    throw new Error(`Unknown onboarding purpose: ${params.purposeId}`);
  }
  return [
    '[Tlon onboarding research directive — not written by the owner]',
    `Research the first notebook entry for: ${params.topics}.`,
    `Content requirements: ${fill(template.entry, params.topics, params.purpose)}`,
    'Use web search whenever the content calls for current information.',
    'Do not create or update a group, channel, cron job, config, notebook,',
    'note, title, or icon. Do not send a chat message. The deterministic Tlon',
    'coordinator owns every side effect. Return only valid JSON with exactly',
    'two string fields: {"title":"concise title","markdown":"complete Markdown entry"}.',
    'Do not wrap the JSON in Markdown fences or include commentary. Include',
    'source links in the Markdown where relevant.',
    `nest: ${params.nest}`,
  ].join(' ');
}
