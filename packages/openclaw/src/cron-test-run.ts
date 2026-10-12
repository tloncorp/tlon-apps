import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type {
  OpenClawConfig,
  OpenClawPluginApi,
} from 'openclaw/plugin-sdk/core';

import {
  type ContextLens,
  type ContextLensStatus,
  ensureBackgroundContextLensForSession,
  finishBackgroundContextLens,
} from './context-lens.js';
import { isCronToolName } from './cron-tool-args-guard.js';
import { sharedMap } from './shared-state.js';
import { isExplicitSilentReply } from './silent-reply.js';
import type { StewardAutomationResponseBody } from './steward-automation-edit.js';
import { summarizeTlonCommand } from './tlon-tool-command.js';

/**
 * Test runs of scheduled tasks: the owner asks for one from the task's
 * screen to see what the task produces without waiting for its schedule.
 *
 * A test run is not a cron run. The job is left exactly as it was: no
 * `run` on the cron service, so its last-run state, its next run and its
 * delivery are untouched. The plugin runs the job's prompt itself in a
 * scratch session, framed the way the host frames a cron turn, and keeps
 * the reply on the run's lens instead of posting it. Anything that would
 * post or change something on Tlon is refused for the length of the run.
 */

const SESSION_MARKER = ':tlon-cron-test:';

export const CRON_TEST_RUN_BLOCK_REASON =
  'This is a test run of a scheduled task. It must not change anything, so this action is blocked. Say what you would have done instead.';

/** Whether a session belongs to a test run, for the tool and telemetry hooks. */
export function isCronTestSessionKey(sessionKey: string | null | undefined) {
  return Boolean(sessionKey?.includes(SESSION_MARKER));
}

/**
 * The reason to refuse a tool call in a test run, or null to allow it.
 * Reading is fine; sending, posting, changing Tlon state, and touching the
 * schedule are not.
 */
export function cronTestRunToolBlock(
  toolName: string,
  params: Record<string, unknown>
): string | null {
  if (toolName === 'message' || isCronToolName(toolName)) {
    return CRON_TEST_RUN_BLOCK_REASON;
  }
  if (toolName === 'tlon') {
    if (typeof params.command !== 'string') {
      return CRON_TEST_RUN_BLOCK_REASON;
    }
    const { intent } = summarizeTlonCommand(params.command);
    return intent === 'read' || intent === 'utility'
      ? null
      : CRON_TEST_RUN_BLOCK_REASON;
  }
  return null;
}

/**
 * The host's cron job as `list` returns it. The plugin SDK declares only a
 * narrow slice; the fields read here are the host's own and all optional.
 */
export type CronTestJob = {
  id: string;
  name?: string;
  agentId?: string;
  payload?: {
    kind?: string;
    message?: string;
    text?: string;
    toolsAllow?: string[];
    model?: string;
    timeoutSeconds?: number;
  };
};

function readJob(raw: unknown): CronTestJob | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const job = raw as Partial<CronTestJob>;
  return typeof job.id === 'string' ? (job as CronTestJob) : null;
}

/** The prompt text a job's payload carries, whichever payload kind it is. */
export function cronTestPromptText(job: CronTestJob): string | null {
  const text =
    job.payload?.kind === 'systemEvent'
      ? job.payload.text
      : (job.payload?.message ?? job.payload?.text);
  return text?.trim() ? text.trim() : null;
}

function formatNow(config: OpenClawConfig, nowMs: number) {
  const configured = (
    config.agents?.defaults as { userTimezone?: string } | undefined
  )?.userTimezone;
  let timeZone = configured?.trim() || undefined;
  let formatted: string;
  try {
    formatted = new Date(nowMs).toLocaleString('en-US', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    timeZone = undefined;
    formatted = new Date(nowMs).toISOString();
  }
  const zone =
    timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const utc = `${new Date(nowMs).toISOString().replace('T', ' ').slice(0, 16)} UTC`;
  return `Current time: ${formatted} (${zone})\nReference UTC: ${utc}`;
}

/**
 * The turn the model sees: the host's cron framing (job tag, prompt, time)
 * and its instruction for a delivered reply sent without the message tool,
 * which is the shape of a test run.
 */
export function buildCronTestPrompt(
  job: CronTestJob,
  prompt: string,
  config: OpenClawConfig,
  nowMs: number
): string {
  return [
    `[cron:${job.id} ${job.name ?? ''}] ${prompt}`.trim(),
    formatNow(config, nowMs),
    '',
    'Return your response as plain text; it will be delivered automatically. If the task explicitly calls for messaging a specific external recipient, note who/where it should go instead of sending it yourself.',
  ].join('\n');
}

type EmbeddedResult = Awaited<
  ReturnType<OpenClawPluginApi['runtime']['agent']['runEmbeddedAgent']>
>;

/** What the run said, and how the run ended. */
export function cronTestRunResult(result: EmbeddedResult): {
  status: ContextLensStatus;
  output?: string;
  error?: string;
} {
  if (result.meta.error) {
    return { status: 'error', error: result.meta.error.message };
  }
  if (result.meta.aborted) {
    return { status: 'aborted', error: 'The test run was stopped.' };
  }
  const visible = (result.payloads ?? [])
    // Hosts from 2026.7 mark pre-tool commentary, which is not the reply.
    .filter(
      (payload) =>
        !payload.isReasoning &&
        !(payload as { isCommentary?: boolean }).isCommentary
    )
    .map((payload) => payload.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n');
  const output = visible || result.meta.finalAssistantVisibleText?.trim();
  if (!output || isExplicitSilentReply(output)) {
    return { status: 'no_reply' };
  }
  return { status: 'completed', output };
}

/**
 * The agent a job without its own `agentId` runs as: the cron service's
 * default when it exposes one, else the config's default agent.
 */
export function defaultCronAgentId(
  cron: unknown,
  config: OpenClawConfig
): string {
  const fromService = (
    cron as { getDefaultAgentId?: () => unknown } | undefined
  )?.getDefaultAgentId?.();
  if (typeof fromService === 'string' && fromService.trim()) {
    return fromService.trim();
  }
  const agents = (config.agents?.list ?? []) as {
    id: string;
    default?: boolean;
  }[];
  return (agents.find((agent) => agent.default) ?? agents[0])?.id ?? 'main';
}

export interface CronTestRunDeps {
  listJobs: () => Promise<readonly unknown[]>;
  defaultAgentId: () => string;
  config: OpenClawConfig;
  runtime: Pick<
    OpenClawPluginApi['runtime']['agent'],
    | 'runEmbeddedAgent'
    | 'resolveAgentWorkspaceDir'
    | 'resolveAgentDir'
    | 'resolveAgentTimeoutMs'
  >;
  stateDir: () => string;
  publish: (phase: string, lens: ContextLens) => void;
  logger: { warn: (message: string) => void };
  now?: () => number;
}

// The test run under way for each job. Asking again while one runs answers
// with the run already going rather than starting a second.
const runningTests = sharedMap<string, string>('cronTestRun.running');

/**
 * Start a test run of job `jobId` and answer as soon as it is under way,
 * with the lens that records it. The run itself continues in the
 * background and finishes its lens when it ends.
 */
export async function startCronTestRun(
  jobId: string,
  deps: CronTestRunDeps
): Promise<StewardAutomationResponseBody> {
  const running = runningTests.get(jobId);
  if (running) {
    return { type: 'started', id: jobId, lensId: running };
  }
  let job: CronTestJob | null = null;
  try {
    job =
      (await deps.listJobs()).map(readJob).find((j) => j?.id === jobId) ?? null;
  } catch (error) {
    return {
      type: 'error',
      errorType: 'harness-error',
      message: [error instanceof Error ? error.message : String(error)],
    };
  }
  if (!job) {
    return {
      type: 'error',
      errorType: 'not-found',
      message: [`unknown cron job id: ${jobId}`],
    };
  }
  const prompt = cronTestPromptText(job);
  if (!prompt) {
    return {
      type: 'error',
      errorType: 'invalid',
      message: ['this task has no prompt to run'],
    };
  }

  const now = deps.now?.() ?? Date.now();
  const agentId = job.agentId?.trim() || deps.defaultAgentId();
  const runId = randomUUID();
  const sessionKey = `agent:${agentId}${SESSION_MARKER}${runId}`;
  const created = ensureBackgroundContextLensForSession(sessionKey, {
    runKind: 'cron',
    trigger: 'cron',
    preview: `cron job ${job.id}`,
    cron: { jobId: job.id, test: true },
  });
  if (!created) {
    return {
      type: 'error',
      errorType: 'harness-error',
      message: ['could not record the test run'],
    };
  }
  const { lensId } = created.lens;
  runningTests.set(jobId, lensId);
  deps.publish('created', created.lens);

  const finish = (end: {
    status: ContextLensStatus;
    output?: string;
    error?: string;
  }) => {
    const lens = finishBackgroundContextLens(lensId, {
      status: end.status,
      ...(end.error === undefined ? {} : { error: end.error }),
      cron: end.output === undefined ? {} : { output: end.output },
    });
    if (lens) {
      deps.publish('final', lens);
    }
  };

  const sessionFile = path.join(
    deps.stateDir(),
    'plugins',
    'tlon',
    'cron-test',
    `${runId}.jsonl`
  );
  // The job's own timeout when it sets one, else the agent timeout the
  // gateway is configured with, as a scheduled run of the job would get.
  const timeoutSeconds = job.payload?.timeoutSeconds;
  const explicitTimeout =
    typeof timeoutSeconds === 'number' && timeoutSeconds > 0
      ? timeoutSeconds
      : undefined;
  const timeoutMs = deps.runtime.resolveAgentTimeoutMs({
    cfg: deps.config,
    ...(explicitTimeout ? { overrideSeconds: explicitTimeout } : {}),
  });
  const run = async () => {
    await mkdir(path.dirname(sessionFile), { recursive: true });
    const result = await deps.runtime.runEmbeddedAgent({
      sessionId: runId,
      sessionKey,
      sessionFile,
      agentId,
      workspaceDir: deps.runtime.resolveAgentWorkspaceDir(deps.config, agentId),
      agentDir: deps.runtime.resolveAgentDir(deps.config, agentId),
      config: deps.config,
      runId,
      // The job's own trigger and id, so the host and this plugin apply the
      // tool policy a scheduled run of this job gets.
      trigger: 'cron',
      jobId: job.id,
      prompt: buildCronTestPrompt(job, prompt, deps.config, now),
      bootstrapContextRunKind: 'cron',
      disableMessageTool: true,
      ...(job.payload?.toolsAllow
        ? { toolsAllow: job.payload.toolsAllow }
        : {}),
      ...(job.payload?.model ? { model: job.payload.model } : {}),
      timeoutMs,
      ...(explicitTimeout ? { runTimeoutOverrideMs: timeoutMs } : {}),
    });
    finish(cronTestRunResult(result));
  };
  void run()
    .catch((error: unknown) => {
      deps.logger.warn(
        `[tlon] Test run of cron job ${job.id} failed: ${String(error)}`
      );
      finish({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      runningTests.delete(jobId);
      void rm(sessionFile, { force: true });
    });
  return { type: 'started', id: jobId, lensId };
}
