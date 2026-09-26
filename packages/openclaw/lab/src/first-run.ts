import { randomUUID } from 'node:crypto';
import { agentOnboardingTesting } from '../../src/monitor/agent-onboarding.js';
import {
  type LabConfig,
  NOTEBOOK_NAME,
  ONBOARDING_GROUP_ID,
  type PromptSources,
} from './config.js';
import { buildSystemPrompt, localTime } from './context.js';
import { type ChatMessage, type CostMeter, chat } from './openrouter.js';
import { executeTool, labTools } from './tools.js';
import type { TaskPlan, ToolCallRecord } from './types.js';

const MAX_TOOL_ROUNDS = 15;

/** The provision request the client sends for a plan, as the coordinator sees it. */
function provisionRequest(plan: TaskPlan, timezone: string) {
  return {
    type: 'tlon-agent-provision',
    version: 1,
    provisionId: randomUUID(),
    groupId: ONBOARDING_GROUP_ID,
    purposeId: plan.purposeId,
    purpose: plan.purpose,
    ...(plan.approach ? { approach: plan.approach } : {}),
    topics: plan.topics,
    scheduleHour: plan.scheduleHour,
    scheduleMinute: plan.scheduleMinute,
    scheduleExpression: `${plan.scheduleMinute} ${plan.scheduleHour} * * *`,
    scheduleDescription: plan.scheduleDescription,
    timezone: plan.timezoneOverride?.trim() || timezone,
    taskPrompt: plan.taskPrompt,
  } as never;
}

export function coordinatorAcknowledgement(plan: TaskPlan, timezone: string) {
  return [
    agentOnboardingTesting.buildProvisionAcknowledgement(
      provisionRequest(plan, timezone),
      NOTEBOOK_NAME
    ),
    agentOnboardingTesting.firstEntryPendingText,
  ];
}

/** The job the coordinator creates, shaped like the plugin's cron slot. */
export function coordinatorJob(plan: TaskPlan, timezone: string) {
  const request = provisionRequest(plan, timezone) as unknown as {
    timezone: string;
  };
  return {
    id: 'job-1',
    name: 'Tlonbot scheduled update',
    enabled: true,
    schedule: {
      kind: 'cron',
      expr: `${plan.scheduleMinute} ${plan.scheduleHour} * * *`,
      tz: request.timezone,
    },
    payload: {
      kind: 'agentTurn',
      message: agentOnboardingTesting.buildRecurringPrompt(
        provisionRequest(plan, timezone)
      ),
    },
    delivery: { mode: 'announce', channel: 'tlon', to: 'Updates notebook' },
  };
}

export function coordinatorReveal(markdown: string) {
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1];
  return agentOnboardingTesting.firstEntryReadyMessage(title);
}

/**
 * Run the scheduled task once, with only web tools, like the cron job. `now`
 * lets the lab run a second day to see whether the notes actually differ.
 */
export async function runScheduledTask(input: {
  plan: TaskPlan;
  config: LabConfig;
  sources: PromptSources;
  timezone: string;
  meter: CostMeter;
  now?: Date;
}): Promise<{ ok: boolean; markdown: string; toolCalls: ToolCallRecord[] }> {
  const { plan, config, sources, timezone, meter, now } = input;
  const tools = labTools({ webOnly: true });
  const system = buildSystemPrompt({
    sources,
    tools,
    botModel: config.models.bot,
    timezone,
    now,
  });
  const prompt = agentOnboardingTesting.buildRecurringPrompt(
    provisionRequest(plan, timezone)
  );
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `[cron run ${localTime(timezone, now)}] ${prompt}`,
    },
  ];
  const toolCalls: ToolCallRecord[] = [];
  const context = {
    sessionKey: `agent:main:cron:lab-${randomUUID()}`,
    runId: randomUUID(),
    onboardingComplete: true,
    sources,
    botModel: config.models.bot,
    braveKey: config.braveKey,
    webOnly: true,
    onChoice: () => {},
    onPlan: () => {},
    onServiceSetup: () => {},
  };
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const reply = await chat({
      key: config.openrouterKey,
      model: config.models.bot,
      messages: [{ role: 'system', content: system }, ...messages],
      tools,
      meter,
    });
    messages.push({
      role: 'assistant',
      content: reply.content,
      ...(reply.toolCalls.length ? { tool_calls: reply.toolCalls } : {}),
    });
    if (!reply.toolCalls.length) {
      const markdown = reply.content?.trim() ?? '';
      return {
        ok: Boolean(markdown) && markdown !== 'NO_REPLY',
        markdown,
        toolCalls,
      };
    }
    for (const call of reply.toolCalls) {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        args = {};
      }
      const record = await executeTool(
        call.id,
        call.function.name,
        args,
        context
      );
      toolCalls.push(record);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: record.result,
      });
    }
  }
  return { ok: false, markdown: '', toolCalls };
}
