import {
  type AgentChoiceToolParams,
  agentChoiceToolMetadata,
  agentChoiceToolParameters,
  createAgentChoiceToolExecutor,
} from '../../src/agent-choice-tool.js';
import {
  type AgentServiceSetupToolParams,
  agentServiceSetupToolMetadata,
  agentServiceSetupToolParameters,
  createAgentServiceSetupToolExecutor,
} from '../../src/agent-service-setup-tool.js';
import {
  type AgentTaskPlanToolParams,
  agentTaskPlanToolMetadata,
  agentTaskPlanToolParameters,
  createAgentTaskPlanToolExecutor,
  resolveOnboardingDmGroupId,
} from '../../src/agent-task-plan-tool.js';
import {
  assertTlonChoiceCallCurrent,
  assertTlonTaskPlanCallCurrent,
  claimTlonChoiceCall,
  claimTlonTaskPlanCall,
  finishTlonChoiceCall,
  finishTlonTaskPlanCall,
  getTlonSessionRunSurface,
  getTlonSessionSurface,
  getTlonTaskPlanEvidence,
  onboardingToolBlockReason,
} from '../../src/onboarding-tool-boundary.js';
import {
  BOT_SHIP,
  ONBOARDING_GROUP_ID,
  OWNER_SHIP,
  type PromptSources,
  renderPrompt,
} from './config.js';
import { type ChatTool, OutOfCreditError } from './openrouter.js';
import type { Choice, TaskPlan, ToolCallRecord } from './types.js';

export type LabTool = ChatTool & { guidelines?: string[] };

export type ToolContext = {
  sessionKey: string;
  runId: string;
  onboardingComplete: boolean;
  sources: PromptSources;
  botModel: string;
  braveKey?: string;
  /** Only web tools, as the scheduled first run gets. */
  webOnly?: boolean;
  onChoice: (choice: Choice) => void;
  onPlan: (plan: TaskPlan) => void;
  onServiceSetup: (providerId: string) => void;
  /** The owner's scheduled jobs, shared across turns so `cron` sees real state. */
  cronJobs?: Record<string, unknown>[];
  onCronChange?: (action: string, job: unknown) => void;
};

function tool(
  name: string,
  description: string,
  parameters: unknown,
  guidelines?: string[]
): LabTool {
  return {
    type: 'function',
    function: { name, description, parameters },
    ...(guidelines ? { guidelines } : {}),
  };
}

const WEB_TOOLS: LabTool[] = [
  tool(
    'web_search',
    'Search the web (Brave). Returns titles, URLs, snippets and ages. Use either freshness or explicit date bounds, never both.',
    {
      type: 'object',
      properties: {
        query: { type: 'string' },
        count: { type: 'integer', minimum: 1, maximum: 10 },
        freshness: {
          type: 'string',
          description: 'pd (past day), pw, pm, or py',
        },
        date_after: { type: 'string', description: 'YYYY-MM-DD' },
        date_before: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['query'],
      additionalProperties: false,
    }
  ),
  tool('web_fetch', 'Fetch a URL and return its readable text.', {
    type: 'object',
    properties: {
      url: { type: 'string' },
      maxChars: { type: 'integer', minimum: 500, maximum: 20000 },
    },
    required: ['url'],
    additionalProperties: false,
  }),
];

export function labTools(context: Pick<ToolContext, 'webOnly'>): LabTool[] {
  if (context.webOnly) return WEB_TOOLS;
  const typed = [
    [agentChoiceToolMetadata, agentChoiceToolParameters],
    [agentTaskPlanToolMetadata, agentTaskPlanToolParameters],
    [agentServiceSetupToolMetadata, agentServiceSetupToolParameters],
  ] as const;
  return [
    tool('read', 'Read a file from the workspace or an installed skill.', {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
      additionalProperties: false,
    }),
    tool(
      'tlon',
      "Tlon/Urbit API for reading data and administration. Examples: 'settings get', 'groups list', 'contacts self'.",
      {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
        additionalProperties: false,
      }
    ),
    tool('cron', 'Create, list, update, or remove scheduled jobs.', {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['add', 'list', 'update', 'remove'] },
        job: { type: 'object' },
        id: { type: 'string' },
      },
      required: ['action'],
    }),
    ...WEB_TOOLS,
    ...typed.map(([meta, parameters]) =>
      tool(meta.name, meta.description, parameters, [
        meta.promptSnippet,
        ...meta.promptGuidelines,
      ])
    ),
  ];
}

function readFile(file: string, context: ToolContext) {
  const clean = file.trim();
  // Installed skills live at ~/.openclaw/plugin-skills/<dir>/...
  const skillPath = /plugin-skills\/([^/]+)\/(.+)$/.exec(clean);
  if (skillPath) {
    const skill = context.sources.skills.find(
      (entry) => entry.dir === skillPath[1]
    );
    if (skill && skillPath[2] === 'SKILL.md') return skill.text;
    if (skill && !skillPath[2].split('/').includes('..')) {
      const resource =
        context.sources.resources[`${skill.dir}/${skillPath[2]}`];
      if (resource) return resource.text;
    }
    throw new Error(`ENOENT: no such file or directory, open '${clean}'`);
  }
  const name = clean.replace(/^\.\//, '');
  const prompt = context.sources.prompts[name];
  if (prompt)
    return renderPrompt(
      prompt.text,
      context.botModel,
      context.sources.substitutions
    );
  throw new Error(`ENOENT: no such file or directory, open '${clean}'`);
}

function runTlon(command: string, context: ToolContext) {
  const clean = command.trim().replace(/^tlon\s+/, '');
  if (/^settings get\b/.test(clean)) {
    return JSON.stringify({ bootstrapComplete: context.onboardingComplete });
  }
  if (/^(groups list|channels groups)\b/.test(clean)) {
    return JSON.stringify([
      {
        id: ONBOARDING_GROUP_ID,
        title: 'Tlonbot',
        channels: [{ nest: 'diary/~ten/updates', title: 'Updates' }],
      },
    ]);
  }
  if (/^contacts self\b/.test(clean)) {
    return JSON.stringify({ ship: BOT_SHIP, nickname: 'Tlonbot' });
  }
  throw new Error(
    `tlon ${clean}: not available in the onboarding lab (only settings get, groups list, contacts self).`
  );
}

async function webSearch(args: Record<string, unknown>, context: ToolContext) {
  if (!context.braveKey) {
    throw new Error('Web search is unavailable right now.');
  }
  const params = new URLSearchParams({
    q: String(args.query ?? ''),
    count: String(Math.min(Number(args.count ?? 5), 10)),
  });
  if (args.date_after || args.date_before) {
    const after = String(args.date_after ?? '2000-01-01');
    const before = String(
      args.date_before ?? new Date().toISOString().slice(0, 10)
    );
    params.set('freshness', `${after}to${before}`);
  } else if (typeof args.freshness === 'string') {
    params.set('freshness', args.freshness);
  }
  const search = () =>
    fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': context.braveKey!,
      },
      signal: AbortSignal.timeout(20_000),
    });
  let response = await search();
  // Parallel lab runs share one key; wait out rate limits instead of failing.
  for (let attempt = 1; response.status === 429 && attempt <= 4; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    response = await search();
  }
  if (response.status === 402) {
    // Out of search quota is a lab failure, not something the bot should
    // work around: every later run would silently lose web search.
    throw new OutOfCreditError(
      `Brave search is out of quota: ${await response.text()}`
    );
  }
  if (!response.ok) {
    throw new Error(`web search failed: ${response.status}`);
  }
  const data = (await response.json()) as {
    web?: {
      results?: {
        title?: string;
        url?: string;
        description?: string;
        age?: string;
      }[];
    };
  };
  return JSON.stringify(
    (data.web?.results ?? []).map((result) => ({
      title: result.title,
      url: result.url,
      snippet: result.description?.replace(/<[^>]+>/g, ''),
      age: result.age,
    }))
  );
}

/** A small in-memory stand-in for OpenClaw's cron store. */
function runCron(args: Record<string, unknown>, context: ToolContext) {
  const jobs = context.cronJobs ?? [];
  const action = String(args.action ?? '');
  const job = (args.job ?? {}) as Record<string, unknown>;
  const id = String(args.id ?? job.id ?? '');
  switch (action) {
    case 'list':
      return JSON.stringify({ jobs });
    case 'add': {
      const added = { ...job, id: `job-${jobs.length + 1}` };
      jobs.push(added);
      context.onCronChange?.('add', added);
      return JSON.stringify({ ok: true, job: added });
    }
    case 'update': {
      const index = jobs.findIndex((entry) => entry.id === id);
      if (index < 0) throw new Error(`no cron job with id ${id}`);
      jobs[index] = { ...jobs[index], ...job, id };
      context.onCronChange?.('update', jobs[index]);
      return JSON.stringify({ ok: true, job: jobs[index] });
    }
    case 'remove': {
      const index = jobs.findIndex((entry) => entry.id === id);
      if (index < 0) throw new Error(`no cron job with id ${id}`);
      const [removed] = jobs.splice(index, 1);
      context.onCronChange?.('remove', removed);
      return JSON.stringify({ ok: true });
    }
    default:
      throw new Error(`unknown cron action ${action}`);
  }
}

async function webFetch(args: Record<string, unknown>) {
  const response = await fetch(String(args.url), {
    signal: AbortSignal.timeout(20_000),
    headers: { 'User-Agent': 'Mozilla/5.0 (onboarding lab)' },
  });
  if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
  const text = (await response.text())
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, Number(args.maxChars ?? 12_000));
}

export async function executeTool(
  id: string,
  name: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<ToolCallRecord> {
  const record = (result: string, extra: Partial<ToolCallRecord> = {}) => ({
    name,
    args,
    result,
    ...extra,
  });

  // The same gate the plugin's before_tool_call hook applies.
  const blockReason =
    onboardingToolBlockReason(
      name,
      args,
      getTlonSessionSurface(context.sessionKey),
      getTlonSessionRunSurface(context.runId)
    ) ??
    (name === 'tlon_agent_choice'
      ? claimTlonChoiceCall({
          toolCallId: id,
          runId: context.runId,
          sessionKey: context.sessionKey,
        })
      : name === 'tlon_agent_task_plan'
        ? claimTlonTaskPlanCall({
            toolCallId: id,
            runId: context.runId,
            sessionKey: context.sessionKey,
          })
        : undefined);
  if (blockReason) {
    return record(`Tool call blocked: ${blockReason}`, { blocked: true });
  }

  try {
    switch (name) {
      case 'read':
        return record(
          readFile(String(args.path ?? args.file_path ?? ''), context)
        );
      case 'tlon':
        return record(runTlon(String(args.command ?? ''), context));
      case 'web_search':
        return record(await webSearch(args, context));
      case 'web_fetch':
        return record(await webFetch(args));
      case 'cron':
        return record(runCron(args, context));
      case 'tlon_agent_choice': {
        const params = args as unknown as AgentChoiceToolParams;
        const execute = createAgentChoiceToolExecutor({
          assertCurrent: assertTlonChoiceCallCurrent,
          finish: finishTlonChoiceCall,
          postChoice: async () => {
            context.onChoice({
              question: params.question.trim(),
              options: params.options.map((option) => option.trim()),
            });
            return 'posted';
          },
        });
        const result = await execute(id, params);
        return record(result.content[0].text, {
          error: Boolean(result.details?.error),
        });
      }
      case 'tlon_agent_task_plan': {
        const params = args as unknown as AgentTaskPlanToolParams;
        const execute = createAgentTaskPlanToolExecutor({
          getEvidence: getTlonTaskPlanEvidence,
          assertCurrent: assertTlonTaskPlanCallCurrent,
          finish: finishTlonTaskPlanCall,
          resolveGroupId: async (target, evidence) =>
            resolveOnboardingDmGroupId(target, evidence),
          postPlan: async () => {
            context.onPlan({ ...params });
            return 'Task plan posted.';
          },
        });
        const result = await execute(id, params);
        return record(result.content[0].text, {
          error: Boolean(result.details?.error),
        });
      }
      case 'tlon_agent_service_setup': {
        const params = args as unknown as AgentServiceSetupToolParams;
        const execute = createAgentServiceSetupToolExecutor({
          postSetup: async () => {
            context.onServiceSetup(params.providerId);
            return 'posted';
          },
        });
        const result = await execute(id, params);
        return record(result.content[0].text, {
          error: Boolean(result.details?.error),
        });
      }
      default:
        throw new Error(`Tool ${name} is not available.`);
    }
  } catch (error) {
    if (error instanceof OutOfCreditError) throw error;
    return record(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
      { error: true }
    );
  }
}

export { OWNER_SHIP };
