import type {
  PluginHookReplyPayloadSendingContext,
  PluginHookReplyPayloadSendingEvent,
  PluginHookReplyPayloadSendingResult,
} from 'openclaw/plugin-sdk/core';

type AfterToolCallEvent = {
  toolName: string;
  runId?: string;
  result?: unknown;
  error?: string;
};

type ToolContext = {
  runId?: string;
  sessionKey?: string;
};

const TASK_PLAN_TOOL_NAME = 'tlon_agent_task_plan';
const COMPLETED_PLAN_TTL_MS = 5 * 60 * 1000;

export const TLON_TASK_PLAN_REPLY_SUPPRESSION_REASON =
  'tlon_task_plan_coordinator_owns_status';

const completedPlanRuns = new Map<string, number>();

function correlationKey(input: {
  runId?: string;
  sessionKey?: string;
}): string | undefined {
  if (input.runId) {
    return `run:${input.runId}`;
  }
  if (input.sessionKey) {
    return `session:${input.sessionKey}`;
  }
  return undefined;
}

function toolResultFailed(event: AfterToolCallEvent): boolean {
  if (event.error?.trim()) {
    return true;
  }
  if (!event.result || typeof event.result !== 'object') {
    return false;
  }

  const result = event.result as {
    content?: Array<{ text?: unknown }>;
    details?: { error?: unknown };
  };
  if (result.details?.error === true) {
    return true;
  }
  return (
    result.content?.some(
      (item) =>
        typeof item.text === 'string' && /^error:/i.test(item.text.trim())
    ) ?? false
  );
}

function pruneCompletedPlanRuns(now = Date.now()) {
  for (const [key, completedAt] of completedPlanRuns) {
    if (now - completedAt > COMPLETED_PLAN_TTL_MS) {
      completedPlanRuns.delete(key);
    }
  }
}

export function recordSuccessfulAgentTaskPlan(
  event: AfterToolCallEvent,
  ctx: ToolContext
): void {
  if (event.toolName !== TASK_PLAN_TOOL_NAME || toolResultFailed(event)) {
    return;
  }
  const key = correlationKey({
    runId: event.runId ?? ctx.runId,
    sessionKey: ctx.sessionKey,
  });
  if (!key) {
    return;
  }
  pruneCompletedPlanRuns();
  completedPlanRuns.set(key, Date.now());
}

/**
 * A successful task-plan tool call posts the visible plan itself and starts the
 * trusted coordinator. Suppress the model's same-run final prose so it cannot
 * race the coordinator and make an unverified or stale activation claim.
 */
export function suppressReplyAfterSuccessfulAgentTaskPlan(
  event: PluginHookReplyPayloadSendingEvent,
  ctx: PluginHookReplyPayloadSendingContext
): PluginHookReplyPayloadSendingResult | undefined {
  if ((event.channel ?? ctx.channelId) !== 'tlon' || event.kind !== 'final') {
    return undefined;
  }
  const key = correlationKey({
    runId: event.runId,
    sessionKey: event.sessionKey ?? ctx.sessionKey,
  });
  if (!key) {
    return undefined;
  }
  pruneCompletedPlanRuns();
  if (!completedPlanRuns.delete(key)) {
    return undefined;
  }
  return {
    cancel: true,
    reason: TLON_TASK_PLAN_REPLY_SUPPRESSION_REASON,
  };
}

export function resetAgentTaskPlanReplyDeliveryForTests(): void {
  completedPlanRuns.clear();
}
