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

const ONBOARDING_SURFACE_TOOL_NAMES = new Set([
  'tlon_agent_choice',
  'tlon_agent_task_plan',
]);
const COMPLETED_PLAN_TTL_MS = 5 * 60 * 1000;

const TLON_ONBOARDING_SURFACE_REPLY_SUPPRESSION_REASON =
  'tlon_onboarding_surface_owns_reply';

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

  return (
    (event.result as { details?: { error?: unknown } }).details?.error === true
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

export function recordSuccessfulAgentOnboardingSurface(
  event: AfterToolCallEvent,
  ctx: ToolContext
): void {
  if (
    !ONBOARDING_SURFACE_TOOL_NAMES.has(event.toolName) ||
    toolResultFailed(event)
  ) {
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

export function suppressReplyAfterSuccessfulAgentOnboardingSurface(
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
    reason: TLON_ONBOARDING_SURFACE_REPLY_SUPPRESSION_REASON,
  };
}

export function resetAgentOnboardingSurfaceReplyDeliveryForTests(): void {
  completedPlanRuns.clear();
  completedPlanSessions.clear();
}
