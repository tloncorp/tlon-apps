import { sharedMap } from './shared-state.js';

export type TlonSessionSurface = {
  kind: 'direct' | 'group';
  senderRole?: 'owner' | 'user';
  channelNest?: string;
  /** Group named by the owner's durable intro request in this bot DM. */
  onboardingGroupId?: string;
  threadParentId?: string;
  bootstrapComplete?: boolean;
  messageId?: string;
  /** Timezone supplied by the owner's onboarding device, not the viewing client. */
  interviewTimezone?: string;
  timestamp: number;
};

export type TlonSessionRunSurface = TlonSessionSurface & {
  sessionKey: string;
};

type TlonTaskPlanCall = {
  runId: string;
  sessionKey: string;
  interviewMessageId: string;
  interviewTimezone?: string;
  timestamp: number;
};

type TlonInterviewStart = {
  messageId: string;
  timestamp: number;
};

type TlonChoiceCall = {
  runId: string;
  sessionKey: string;
  ownerMessageId: string;
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
const choiceRunClaims = sharedMap<string, string>(
  'onboarding-choice-run-claims'
);
const taskPlanCalls = sharedMap<string, TlonTaskPlanCall>(
  'onboarding-task-plan-calls'
);
const interviewStarts = sharedMap<string, TlonInterviewStart>(
  'onboarding-interview-starts'
);
const choiceCalls = sharedMap<string, TlonChoiceCall>(
  'onboarding-choice-calls'
);
const SURFACE_TTL_MS = 60 * 60 * 1000;

function baseSessionKey(sessionKey: string): string {
  const threadIndex = sessionKey.indexOf(':thread:');
  return threadIndex > 0 ? sessionKey.slice(0, threadIndex) : sessionKey;
}

export function resolveTlonSessionThreadParentId(
  isThreadReply: boolean | undefined,
  parentId: string | null | undefined
): string | undefined {
  const normalized = parentId?.trim();
  return isThreadReply && normalized ? normalized : undefined;
}

export function resolveTlonSessionOwnerMessageId(
  senderRole: 'owner' | 'user',
  messageId: string,
  previousMessageId?: string
): string | undefined {
  return senderRole === 'owner' ? messageId : previousMessageId;
}

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
  for (const [key, entry] of interviewStarts) {
    if (now - entry.timestamp > SURFACE_TTL_MS) {
      interviewStarts.delete(key);
    }
  }
  for (const [key, entry] of choiceCalls) {
    if (now - entry.timestamp > SURFACE_TTL_MS) {
      choiceCalls.delete(key);
      if (choiceRunClaims.get(entry.runId) === key) {
        choiceRunClaims.delete(entry.runId);
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
  sessionKey: string,
  runContext?: Pick<TlonSessionSurface, 'senderRole'>
): void {
  const surface = getTlonSessionSurface(sessionKey);
  if (!surface) return;
  pruneExpiredSurfaces();
  sessionRunSurfaces.set(runId, { ...surface, ...runContext, sessionKey });
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
  choiceRunClaims.delete(key);
  const callId = taskPlanRunClaims.get(key);
  if (callId) taskPlanCalls.delete(callId);
  taskPlanRunClaims.delete(key);
}

export function rememberTlonInterviewStart(
  runId: string | null | undefined,
  sessionKey: string | null | undefined
): void {
  const key = sessionKey?.trim();
  const runSurface = getTlonSessionRunSurface(runId);
  if (!key || !runSurface?.messageId || runSurface.sessionKey !== key) return;
  pruneExpiredSurfaces();
  const interviewKey = baseSessionKey(key);
  if (!interviewStarts.has(interviewKey)) {
    interviewStarts.set(interviewKey, {
      messageId: runSurface.messageId,
      timestamp: Date.now(),
    });
  }
}

export function claimTlonChoiceCall(input: {
  toolCallId?: string;
  runId?: string;
  sessionKey?: string;
}): string | undefined {
  const toolCallId = input.toolCallId?.trim();
  const runId = input.runId?.trim();
  const sessionKey = input.sessionKey?.trim();
  if (!toolCallId || !runId || !sessionKey) {
    return 'The interview coordinator could not bind this choice to the current owner turn.';
  }
  const existingCallId = choiceRunClaims.get(runId);
  if (existingCallId) {
    return (
      'A choice was already posted in this owner turn. Return NO_REPLY now ' +
      'and wait for the owner answer; do not post another question or call another tool.'
    );
  }
  const runSurface = getTlonSessionRunSurface(runId);
  if (!runSurface?.messageId || runSurface.sessionKey !== sessionKey) {
    return 'The interview coordinator could not identify the owner message that started this turn.';
  }
  rememberTlonInterviewStart(runId, sessionKey);
  choiceCalls.set(toolCallId, {
    runId,
    sessionKey,
    ownerMessageId: runSurface.messageId,
    timestamp: Date.now(),
  });
  choiceRunClaims.set(runId, toolCallId);
  return undefined;
}

export function assertTlonChoiceCallCurrent(toolCallId: string): void {
  const call = choiceCalls.get(toolCallId);
  if (!call) throw new Error('choice is not bound to the current owner turn');
  if (
    getTlonSessionSurface(call.sessionKey)?.messageId !== call.ownerMessageId
  ) {
    throw new Error(
      'A newer owner message arrived during this response. The stale choice was not posted.'
    );
  }
}

export function finishTlonChoiceCall(
  toolCallId: string,
  retainClaim: boolean
): void {
  const call = choiceCalls.get(toolCallId);
  if (!call || retainClaim) return;
  choiceCalls.delete(toolCallId);
  if (choiceRunClaims.get(call.runId) === toolCallId) {
    choiceRunClaims.delete(call.runId);
  }
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
  if (choiceRunClaims.has(runId)) {
    return (
      'A choice was already posted in this owner turn. Return NO_REPLY now ' +
      'and wait for the owner answer; do not post a task plan or call another tool.'
    );
  }
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
  // A plan may be the first typed action when the owner's message already
  // supplies consent, purpose, and time. Bind that owner turn as the interview
  // start instead of requiring a throwaway choice solely to create evidence.
  rememberTlonInterviewStart(runId, sessionKey);
  taskPlanRunClaims.set(runId, toolCallId);
  taskPlanCalls.set(toolCallId, {
    runId,
    sessionKey,
    interviewMessageId: runSurface.messageId,
    ...(runSurface.interviewTimezone
      ? { interviewTimezone: runSurface.interviewTimezone }
      : {}),
    timestamp: Date.now(),
  });
  return undefined;
}

export function getTlonTaskPlanEvidence(toolCallId: string): {
  interviewStartMessageId?: string;
  interviewMessageId: string;
  interviewTimezone?: string;
  onboardingGroupId?: string;
  onboardingTarget?: string;
} {
  pruneExpiredSurfaces();
  const call = taskPlanCalls.get(toolCallId);
  if (!call) {
    throw new Error('task plan is not bound to the current owner turn');
  }
  const interviewStart = interviewStarts.get(baseSessionKey(call.sessionKey));
  const runSurface = getTlonSessionRunSurface(call.runId);
  return {
    ...(interviewStart
      ? { interviewStartMessageId: interviewStart.messageId }
      : {}),
    interviewMessageId: call.interviewMessageId,
    ...(call.interviewTimezone
      ? { interviewTimezone: call.interviewTimezone }
      : {}),
    ...(runSurface?.kind === 'direct' && runSurface.onboardingGroupId
      ? {
          onboardingGroupId: runSurface.onboardingGroupId,
          onboardingTarget: runSurface.channelNest,
        }
      : {}),
  };
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
  retainClaim: boolean
): void {
  const call = taskPlanCalls.get(toolCallId);
  if (!call) return;
  if (retainClaim) {
    interviewStarts.delete(baseSessionKey(call.sessionKey));
    return;
  }
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
    if (
      !surface?.channelNest ||
      (surface.kind !== 'group' &&
        !(surface.kind === 'direct' && surface.onboardingGroupId))
    ) {
      return (
        'Recurring-task onboarding is available only in the active Tlonbot ' +
        'group or its furnished first-run bot DM. Tell the owner to choose +, then New Tlonbot group, and stop.'
      );
    }
    if (runSurface?.threadParentId ?? surface.threadParentId) {
      return (
        'Recurring-task onboarding actions are not supported from a thread. ' +
        'Continue in the main group conversation, then try again.'
      );
    }
    const target =
      params && typeof params === 'object' && 'target' in params
        ? String((params as { target?: unknown }).target ?? '')
        : '';
    if (target !== surface.channelNest) {
      return 'The onboarding tool target must match the active conversation.';
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

  if (toolName === 'cron' && surface?.bootstrapComplete === false) {
    return surface.kind === 'direct' && !surface.onboardingGroupId
      ? 'First-run recurring-task provisioning is owned by the group coordinator. Tell the owner to choose +, then New Tlonbot group, and stop.'
      : 'Recurring-task onboarding provisioning is owned by the typed task-plan coordinator. Post a current tlon_agent_task_plan to activate the agreed task, and do not call cron directly.';
  }

  return undefined;
}

export const _testing = {
  clearAll: () => {
    sessionSurfaces.clear();
    sessionRunSurfaces.clear();
    taskPlanRunClaims.clear();
    choiceRunClaims.clear();
    taskPlanCalls.clear();
    interviewStarts.clear();
    choiceCalls.clear();
  },
};
