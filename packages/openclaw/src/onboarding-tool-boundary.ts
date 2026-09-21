import { sharedMap } from './shared-state.js';

export type TlonSessionSurface = {
  kind: 'direct' | 'group';
  channelNest?: string;
  bootstrapComplete: boolean;
  messageId?: string;
  timestamp: number;
};

export type TlonSessionRunSurface = TlonSessionSurface & {
  sessionKey: string;
};

type TlonTaskPlanCall = {
  runId: string;
  sessionKey: string;
  interviewMessageId: string;
  timestamp: number;
};

const sessionSurfaces = sharedMap<string, TlonSessionSurface>(
  'onboarding-session-surfaces'
);
const sessionRunSurfaces = sharedMap<string, TlonSessionRunSurface>(
  'onboarding-session-run-surfaces'
);
const taskPlanRunClaims = sharedMap<string, string>(
  'onboarding-task-plan-run-claims'
);
const taskPlanCalls = sharedMap<string, TlonTaskPlanCall>(
  'onboarding-task-plan-calls'
);
const SURFACE_TTL_MS = 60 * 60 * 1000;

function pruneExpiredSurfaces(now = Date.now()): void {
  for (const [key, entry] of sessionSurfaces) {
    if (now - entry.timestamp > SURFACE_TTL_MS) {
      sessionSurfaces.delete(key);
    }
  }
  for (const [key, entry] of sessionRunSurfaces) {
    if (now - entry.timestamp > SURFACE_TTL_MS) {
      sessionRunSurfaces.delete(key);
    }
  }
  for (const [callId, entry] of taskPlanCalls) {
    if (now - entry.timestamp > SURFACE_TTL_MS) {
      taskPlanCalls.delete(callId);
      if (taskPlanRunClaims.get(entry.runId) === callId) {
        taskPlanRunClaims.delete(entry.runId);
      }
    }
  }
}

export function setTlonSessionSurface(
  sessionKey: string,
  surface: Omit<TlonSessionSurface, 'timestamp'>
): void {
  const now = Date.now();
  pruneExpiredSurfaces(now);
  sessionSurfaces.set(sessionKey, { ...surface, timestamp: now });
}

export function getTlonSessionSurface(
  sessionKey: string | null | undefined
): TlonSessionSurface | undefined {
  const key = sessionKey?.trim();
  if (!key) return undefined;

  const lookup = (candidate: string) => {
    const entry = sessionSurfaces.get(candidate);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > SURFACE_TTL_MS) {
      sessionSurfaces.delete(candidate);
      return undefined;
    }
    return entry;
  };

  const direct = lookup(key);
  if (direct) return direct;
  const threadIndex = key.indexOf(':thread:');
  return threadIndex > 0 ? lookup(key.slice(0, threadIndex)) : undefined;
}

export function rememberTlonSessionRunSurface(
  runId: string,
  sessionKey: string
): void {
  const surface = getTlonSessionSurface(sessionKey);
  if (!surface) return;
  pruneExpiredSurfaces();
  sessionRunSurfaces.set(runId, { ...surface, sessionKey });
}

export function getTlonSessionRunSurface(
  runId: string | null | undefined
): TlonSessionRunSurface | undefined {
  const key = runId?.trim();
  if (!key) return undefined;
  const surface = sessionRunSurfaces.get(key);
  if (!surface) return undefined;
  if (Date.now() - surface.timestamp > SURFACE_TTL_MS) {
    sessionRunSurfaces.delete(key);
    return undefined;
  }
  return surface;
}

export function clearTlonSessionRunSurface(
  runId: string | null | undefined
): void {
  const key = runId?.trim();
  if (!key) return;
  sessionRunSurfaces.delete(key);
  const callId = taskPlanRunClaims.get(key);
  if (callId) taskPlanCalls.delete(callId);
  taskPlanRunClaims.delete(key);
}

export function claimTlonTaskPlanCall(input: {
  toolCallId?: string;
  runId?: string;
  sessionKey?: string;
}): string | undefined {
  const toolCallId = input.toolCallId?.trim();
  const runId = input.runId?.trim();
  const sessionKey = input.sessionKey?.trim();
  if (!toolCallId || !runId || !sessionKey) {
    return 'The task-plan coordinator could not bind this call to the current owner turn.';
  }

  pruneExpiredSurfaces();
  const existingCallId = taskPlanRunClaims.get(runId);
  if (existingCallId) {
    return existingCallId === toolCallId
      ? undefined
      : 'Only one task plan may be posted from an owner turn.';
  }

  const runSurface = getTlonSessionRunSurface(runId);
  if (!runSurface?.messageId || runSurface.sessionKey !== sessionKey) {
    return 'The task-plan coordinator could not identify the owner message that started this turn.';
  }

  taskPlanRunClaims.set(runId, toolCallId);
  taskPlanCalls.set(toolCallId, {
    runId,
    sessionKey,
    interviewMessageId: runSurface.messageId,
    timestamp: Date.now(),
  });
  return undefined;
}

export function getTlonTaskPlanEvidence(toolCallId: string): {
  interviewMessageId: string;
} {
  pruneExpiredSurfaces();
  const call = taskPlanCalls.get(toolCallId);
  if (!call) {
    throw new Error('task plan is not bound to the current owner turn');
  }
  return { interviewMessageId: call.interviewMessageId };
}

export function assertTlonTaskPlanCallCurrent(toolCallId: string): void {
  const call = taskPlanCalls.get(toolCallId);
  if (!call) {
    throw new Error('task plan is not bound to the current owner turn');
  }
  const current = getTlonSessionSurface(call.sessionKey);
  if (current?.messageId !== call.interviewMessageId) {
    throw new Error(
      'A newer owner message arrived during this response. The stale task plan was not posted.'
    );
  }
}

export function finishTlonTaskPlanCall(
  toolCallId: string,
  succeeded: boolean
): void {
  const call = taskPlanCalls.get(toolCallId);
  if (!call) return;
  if (succeeded) return;
  taskPlanCalls.delete(toolCallId);
  if (taskPlanRunClaims.get(call.runId) === toolCallId) {
    taskPlanRunClaims.delete(call.runId);
  }
}

export function onboardingToolBlockReason(
  toolName: string,
  params: unknown,
  surface: TlonSessionSurface | undefined,
  runSurface?: TlonSessionRunSurface
): string | undefined {
  const isTypedOnboardingTool =
    toolName === 'tlon_agent_choice' ||
    toolName === 'tlon_agent_task_plan' ||
    toolName === 'tlon_agent_service_setup';

  if (isTypedOnboardingTool) {
    if (surface?.kind !== 'group' || !surface.channelNest) {
      return (
        'Recurring-task onboarding is available only in the active Tlonbot ' +
        'group. Tell the owner to choose +, then New Tlonbot group, and stop.'
      );
    }
    const target =
      params && typeof params === 'object' && 'target' in params
        ? String((params as { target?: unknown }).target ?? '')
        : '';
    if (target !== surface.channelNest) {
      return 'The onboarding tool target must match the active group channel.';
    }
    if (
      surface.messageId &&
      runSurface?.messageId &&
      surface.messageId !== runSurface.messageId
    ) {
      return (
        'A newer owner message arrived during this response. Do not post this ' +
        'onboarding action; stop and let the newer owner turn handle the latest intent.'
      );
    }
  }

  if (toolName === 'cron' && surface && !surface.bootstrapComplete) {
    return surface.kind === 'direct'
      ? 'First-run recurring-task provisioning is owned by the group coordinator. Tell the owner to choose +, then New Tlonbot group, and stop.'
      : 'Recurring-task onboarding provisioning is owned by the typed task-plan coordinator. Post a current tlon_agent_task_plan for the owner to confirm, and do not call cron directly.';
  }

  return undefined;
}

export const _testing = {
  clearAll: () => {
    sessionSurfaces.clear();
    sessionRunSurfaces.clear();
    taskPlanRunClaims.clear();
    taskPlanCalls.clear();
  },
};
