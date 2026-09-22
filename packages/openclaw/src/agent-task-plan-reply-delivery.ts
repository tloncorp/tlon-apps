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

type CompletedPlanMarker = {
  completedAt: number;
  runKey?: string;
  sessionKey?: string;
};

const completedPlanRuns = new Map<string, CompletedPlanMarker>();
const completedPlanSessions = new Map<string, CompletedPlanMarker[]>();

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
  for (const [key, marker] of completedPlanRuns) {
    if (now - marker.completedAt > COMPLETED_PLAN_TTL_MS) {
      completedPlanRuns.delete(key);
    }
  }
  for (const [key, queue] of completedPlanSessions) {
    const active = queue.filter(
      (marker) => now - marker.completedAt <= COMPLETED_PLAN_TTL_MS
    );
    if (active.length > 0) {
      completedPlanSessions.set(key, active);
    } else {
      completedPlanSessions.delete(key);
    }
  }
}

function consumeMarker(marker: CompletedPlanMarker): void {
  if (marker.runKey && completedPlanRuns.get(marker.runKey) === marker) {
    completedPlanRuns.delete(marker.runKey);
  }
  if (!marker.sessionKey) return;
  const queue = completedPlanSessions.get(marker.sessionKey);
  if (!queue) return;
  const remaining = queue.filter((candidate) => candidate !== marker);
  if (remaining.length > 0) {
    completedPlanSessions.set(marker.sessionKey, remaining);
  } else {
    completedPlanSessions.delete(marker.sessionKey);
  }
}

export function recordSuccessfulAgentTaskPlan(
  event: AfterToolCallEvent,
  ctx: ToolContext
): void {
  if (event.toolName !== TASK_PLAN_TOOL_NAME || toolResultFailed(event)) {
    return;
  }
  const runId = event.runId ?? ctx.runId;
  const runKey = runId ? `run:${runId}` : undefined;
  const sessionKey = ctx.sessionKey ? `session:${ctx.sessionKey}` : undefined;
  if (!runKey && !sessionKey) {
    return;
  }
  pruneCompletedPlanRuns();
  const marker = { completedAt: Date.now(), runKey, sessionKey };
  if (runKey) {
    const existing = completedPlanRuns.get(runKey);
    if (existing) consumeMarker(existing);
    completedPlanRuns.set(runKey, marker);
  }
  if (sessionKey) {
    const queue = completedPlanSessions.get(sessionKey) ?? [];
    queue.push(marker);
    completedPlanSessions.set(sessionKey, queue);
  }
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
  pruneCompletedPlanRuns();
  const sessionKey = event.sessionKey ?? ctx.sessionKey;
  const marker = event.runId
    ? completedPlanRuns.get(`run:${event.runId}`)
    : sessionKey
      ? completedPlanSessions.get(`session:${sessionKey}`)?.[0]
      : undefined;
  if (!marker) {
    return undefined;
  }
  consumeMarker(marker);
  return {
    cancel: true,
    reason: TLON_TASK_PLAN_REPLY_SUPPRESSION_REASON,
  };
}

export function resetAgentTaskPlanReplyDeliveryForTests(): void {
  completedPlanRuns.clear();
  completedPlanSessions.clear();
}
