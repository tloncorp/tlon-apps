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
  cronLensTtlMs,
  ensureBackgroundContextLensForSession,
  finishBackgroundContextLens,
} from './context-lens.js';
import { BUDGET_HOLD_PREFIX } from './cron-budget-hold.js';
import { runEmbeddedAgentWithFallbacks } from './embedded-agent-fallbacks.js';
import {
  isMcpDescribeToolName,
  isMcpListUpstreamsToolName,
} from './mcp-readonly-policy.js';
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
 * might change anything is refused for the length of the run.
 */

const SESSION_MARKER = ':tlon-cron-test:';

export const CRON_TEST_RUN_BLOCK_REASON =
  'This is a test run of a scheduled task. It must not change anything, so this action is blocked. Say what you would have done instead.';

/** Whether a session belongs to a test run, for the tool and telemetry hooks. */
export function isCronTestSessionKey(sessionKey: string | null | undefined) {
  return Boolean(sessionKey?.includes(SESSION_MARKER));
}

// The host's own list of tools that only read (SAFE_READ_ONLY_TOOLS in
// OpenClaw's agent consult policy).
const READ_ONLY_TOOLS = new Set([
  'read',
  'web_search',
  'web_fetch',
  'x_search',
  'memory_search',
  'memory_get',
]);

/**
 * The reason to refuse a tool call in a test run, or null to allow it. A
 * test fails closed: only tools known to just read run, along with Tlon
 * reads and an MCP server's tool catalog. Anything else, including tools
 * this list has never heard of, is refused, and the model is told to say
 * what it would have done.
 */
export function cronTestRunToolBlock(
  toolName: string,
  params: Record<string, unknown>
): string | null {
  if (
    READ_ONLY_TOOLS.has(toolName) ||
    isMcpDescribeToolName(toolName) ||
    isMcpListUpstreamsToolName(toolName)
  ) {
    return null;
  }
  if (toolName === 'tlon' && typeof params.command === 'string') {
    return summarizeTlonCommand(params.command).intent === 'read'
      ? null
      : CRON_TEST_RUN_BLOCK_REASON;
  }
  return CRON_TEST_RUN_BLOCK_REASON;
}

/**
 * The host's cron job as `list` returns it. The plugin SDK declares only a
 * narrow slice; the fields read here are the host's own and all optional.
 */
export type CronTestJob = {
  id: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  updatedAtMs?: number;
  agentId?: string;
  sessionTarget?: string;
  payload?: {
    kind?: string;
    message?: string;
    text?: string;
    toolsAllow?: string[];
    model?: string;
    fallbacks?: string[];
    timeoutSeconds?: number;
    lightContext?: boolean;
    thinking?: string;
  };
};

function readJob(raw: unknown): CronTestJob | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const job = raw as Partial<CronTestJob>;
  return typeof job.id === 'string' ? (job as CronTestJob) : null;
}

/**
 * Whether a test can stand in for the job: an agent turn in a session of its
 * own. A main-session job, or a system event, runs inside the bot's ongoing
 * conversation, which a scratch session has none of, so a test would show
 * something the schedule never produces.
 */
export function canTestCronJob(job: CronTestJob): boolean {
  const target = job.sessionTarget?.trim();
  return (
    (!target || target === 'isolated') &&
    (job.payload?.kind ?? 'agentTurn') === 'agentTurn'
  );
}

/** The prompt an agent-turn job runs. */
export function cronTestPromptText(job: CronTestJob): string | null {
  const text = job.payload?.message ?? job.payload?.text;
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
  // A scratch session has nothing else to abort it: the monitor's teardown
  // is caught before this, so what is left is the run's own time limit.
  if (result.meta.aborted) {
    return { status: 'timed_out', error: 'The test run ran out of time.' };
  }
  const replies = (result.payloads ?? []).filter(
    (payload) =>
      // Hosts from 2026.7 mark pre-tool commentary, which is not the reply.
      !payload.isReasoning &&
      !(payload as { isCommentary?: boolean }).isCommentary
  );
  const visible = replies
    .filter((payload) => !payload.isError)
    .map((payload) => payload.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n');
  const output = visible || result.meta.finalAssistantVisibleText?.trim();
  // A provider failure can come back as an error payload alone. One after a
  // reply is the host's warning about a failed tool, as a blocked write
  // gives here, and the reply still stands.
  const lastError = replies.findLast((payload) => payload.isError);
  if (!output && lastError) {
    return {
      status: 'error',
      error: lastError.text?.trim() || 'The run returned an error.',
    };
  }
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
    | 'normalizeThinkingLevel'
  >;
  stateDir: () => string;
  publish: (phase: string, lens: ContextLens) => void;
  logger: { warn: (message: string) => void };
  /** The monitor's teardown: a test still running then stops as aborted. */
  signal?: AbortSignal;
  now?: () => number;
}

const STOPPED = {
  status: 'aborted',
  error: 'The test run was stopped.',
} as const;

// The test run under way for each job, and the version of the job it runs.
// Asking again while one runs answers with the run already going rather
// than starting a second, unless the job has changed since.
const runningTests = sharedMap<
  string,
  { lensId: string; updatedAtMs: number | undefined }
>('cronTestRun.running');

/**
 * Start a test run of job `jobId` and answer as soon as it is under way,
 * with the lens that records it. The run itself continues in the
 * background and finishes its lens when it ends.
 */
export async function startCronTestRun(
  jobId: string,
  deps: CronTestRunDeps
): Promise<StewardAutomationResponseBody> {
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
  const running = runningTests.get(jobId);
  if (running && running.updatedAtMs === job.updatedAtMs) {
    return { type: 'started', id: jobId, lensId: running.lensId };
  }
  if (!canTestCronJob(job)) {
    return {
      type: 'error',
      errorType: 'invalid',
      message: [
        'only a task that runs in its own session can be tested; this one runs in the main session',
      ],
    };
  }
  // A job the credit budget paused would spend the same credits on a test.
  if (
    job.enabled === false &&
    job.description?.startsWith(BUDGET_HOLD_PREFIX.trimEnd())
  ) {
    return {
      type: 'error',
      errorType: 'invalid',
      message: ['this task is paused while credits are limited'],
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
  const created = ensureBackgroundContextLensForSession(sessionKey, {
    runKind: 'cron',
    trigger: 'cron',
    preview: `cron job ${job.id}`,
    cron: { jobId: job.id, test: true },
    // The lens must outlive the run, however long the run may take, or its
    // finish finds nothing and the owner is left with a run that never ends.
    ttlMs: cronLensTtlMs(timeoutMs),
  });
  if (!created) {
    return {
      type: 'error',
      errorType: 'harness-error',
      message: ['could not record the test run'],
    };
  }
  const { lensId } = created.lens;
  runningTests.set(jobId, { lensId, updatedAtMs: job.updatedAtMs });
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
  const fallbacks = job.payload?.fallbacks;
  const thinkLevel = job.payload?.thinking
    ? deps.runtime.normalizeThinkingLevel(job.payload.thinking)
    : undefined;
  const run = async () => {
    await mkdir(path.dirname(sessionFile), { recursive: true });
    const result = await runEmbeddedAgentWithFallbacks(
      {
        runEmbeddedAgent: (params) => deps.runtime.runEmbeddedAgent(params),
        logger: deps.logger,
      },
      {
        sessionId: runId,
        sessionKey,
        sessionFile,
        agentId,
        workspaceDir: deps.runtime.resolveAgentWorkspaceDir(
          deps.config,
          agentId
        ),
        agentDir: deps.runtime.resolveAgentDir(deps.config, agentId),
        config: deps.config,
        runId,
        // The job's own trigger and id, so the host and this plugin apply the
        // tool policy a scheduled run of this job gets.
        trigger: 'cron',
        jobId: job.id,
        prompt: buildCronTestPrompt(job, prompt, deps.config, now),
        bootstrapContextRunKind: 'cron',
        // The context and thinking level the job asks for, as its scheduled
        // run gets them, so the test answers the same way.
        ...(job.payload?.lightContext === true
          ? { bootstrapContextMode: 'lightweight' as const }
          : {}),
        ...(thinkLevel ? { thinkLevel } : {}),
        // Each test is a scratch session nothing resumes; leave no MCP
        // runtime behind for it.
        cleanupBundleMcpOnRunEnd: true,
        disableMessageTool: true,
        ...(job.payload?.toolsAllow
          ? { toolsAllow: job.payload.toolsAllow }
          : {}),
        timeoutMs,
        ...(explicitTimeout ? { runTimeoutOverrideMs: timeoutMs } : {}),
        ...(deps.signal ? { abortSignal: deps.signal } : {}),
      },
      {
        label: `Test run of cron job ${job.id}`,
        // The job's model and fallbacks when it names them, as a scheduled
        // run would use; the agent's configured ones otherwise.
        ...(job.payload?.model ? { primary: job.payload.model } : {}),
        ...(Array.isArray(fallbacks) ? { fallbacks } : {}),
      }
    );
    finish(deps.signal?.aborted ? STOPPED : cronTestRunResult(result));
  };
  void run()
    .catch((error: unknown) => {
      if (deps.signal?.aborted) {
        finish(STOPPED);
        return;
      }
      deps.logger.warn(
        `[tlon] Test run of cron job ${job.id} failed: ${String(error)}`
      );
      finish({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      // A test of the job's newer version may have taken the slot.
      if (runningTests.get(jobId)?.lensId === lensId) {
        runningTests.delete(jobId);
      }
      // The transcript holds the prompt and the reply; say if it is left.
      rm(sessionFile, { force: true }).catch((error: unknown) => {
        deps.logger.warn(
          `[tlon] Could not remove the test run transcript ${sessionFile}: ${String(error)}`
        );
      });
    });
  return { type: 'started', id: jobId, lensId };
}
