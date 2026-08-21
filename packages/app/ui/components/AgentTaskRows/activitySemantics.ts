import { hasContextLensActivityCardContent } from '@tloncorp/api/urbit/lens';

import { effectiveLensStatus } from '../Channel/ContextLens/format';
import type {
  ContextLensActivity,
  ContextLensActivityEvent,
  ContextLensActivityItem,
} from '../Channel/ContextLens/types';
import type { ContextLensEvent } from '../Channel/ContextLens/types';

const TERMINAL_FEEDBACK_STATUSES = new Set([
  'no_reply',
  'timed_out',
  'aborted',
  'error',
]);

function activityKind(item: Pick<ContextLensActivityItem, 'kind'>) {
  // request_input is part of the structured producer contract. Keep this
  // boundary tolerant while older Lens schema packages are still readable.
  return item.kind as string;
}

export function isStructuredWaitingActivityItem(item: ContextLensActivityItem) {
  const kind = activityKind(item);
  return (
    item.status === 'waiting' &&
    (kind === 'approval' || kind === 'request_input')
  );
}

export function isStructuredAgentChatActivityItem(
  item: ContextLensActivityItem
) {
  const kind = activityKind(item);
  if (kind === 'tool') {
    const name = item.name ?? item.title;
    return !isPlanningToolName(name);
  }
  return (
    kind === 'commentary' ||
    kind === 'approval' ||
    kind === 'request_input' ||
    kind === 'command' ||
    kind === 'patch' ||
    kind === 'error'
  );
}

function isPlanningToolName(name: string | null | undefined) {
  if (!name) return false;
  const leaf = name.trim().toLowerCase().split('.').at(-1);
  return leaf?.replaceAll('-', '_') === 'update_plan';
}

export function hasStructuredAgentChatActivity(
  activity: ContextLensActivity | null | undefined
) {
  return hasContextLensActivityCardContent(activity);
}

function hasStructuredLiveEvent(event: ContextLensActivityEvent | undefined) {
  if (!event) return false;
  if (event.kind === 'tool') {
    return Boolean(event.name && !isPlanningToolName(event.name));
  }
  return (
    event.kind === 'commentary' ||
    event.kind === 'approval' ||
    event.kind === 'request_input' ||
    event.kind === 'command' ||
    event.kind === 'patch' ||
    event.kind === 'error'
  );
}

export function hasAgentChatActionToolEvidence(event: ContextLensEvent) {
  const names = [
    ...event.lens.tools.called,
    ...(event.lens.tools.runs?.map((run) => run.name) ?? []),
  ].filter(Boolean);
  if (names.some((name) => !isPlanningToolName(name))) return true;
  if (names.length > 0) return false;
  return event.lens.tools.callCount > 0;
}

export function hasStructuredAgentChatEvidence(event: ContextLensEvent) {
  return (
    event.lens.activity?.items.some(isStructuredAgentChatActivityItem) ===
      true ||
    hasAgentChatActionToolEvidence(event) ||
    hasStructuredLiveEvent(event.detail?.activity) ||
    hasStructuredRequestInputContinuation(event)
  );
}

function nonEmptyId(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * A typed required-input continuation is itself user-facing task evidence.
 * It lets a resumed one-step plan remain visible without making arbitrary
 * plan-only or update_plan-only turns eligible again.
 */
export function structuredRequestInputContinuationParent(
  event: ContextLensEvent
):
  | { kind: 'owner'; parentLensId: string; requestInputId: string }
  | { kind: 'participant'; parentPublicRunId: string }
  | null {
  const continuation = event.lens.continuation;
  if (
    continuation?.kind === 'request_input' &&
    continuation.parentLensId !== event.lens.lensId &&
    nonEmptyId(continuation.parentLensId) &&
    nonEmptyId(continuation.requestInputId) &&
    nonEmptyId(continuation.workflowId) &&
    Number.isFinite(continuation.linkedAt) &&
    continuation.linkedAt >= 0
  ) {
    return {
      kind: 'owner',
      parentLensId: continuation.parentLensId,
      requestInputId: continuation.requestInputId,
    };
  }

  const participantContinuation = (
    event as ContextLensEvent & {
      participantActivity?: {
        publicRunId?: unknown;
        continuation?: {
          kind?: unknown;
          parentPublicRunId?: unknown;
        };
      };
    }
  ).participantActivity?.continuation;
  const publicRunId = (
    event as ContextLensEvent & {
      participantActivity?: { publicRunId?: unknown };
    }
  ).participantActivity?.publicRunId;
  if (
    participantContinuation?.kind === 'request_input' &&
    nonEmptyId(participantContinuation.parentPublicRunId) &&
    participantContinuation.parentPublicRunId !== publicRunId
  ) {
    return {
      kind: 'participant',
      parentPublicRunId: participantContinuation.parentPublicRunId as string,
    };
  }
  return null;
}

export function hasStructuredRequestInputContinuation(event: ContextLensEvent) {
  return structuredRequestInputContinuationParent(event) !== null;
}

export function hasStructuredAgentChatWait(event: ContextLensEvent) {
  const activity = event.lens.activity;
  return Boolean(
    activity?.plan?.steps.some((step) => step.status === 'waiting') ||
      activity?.items.some(isStructuredWaitingActivityItem)
  );
}

export type AgentChatWaitingAudience = 'owner' | 'requester';

export function agentChatWaitingAudience(
  event: ContextLensEvent
): AgentChatWaitingAudience | null {
  const projectedAudience = (
    event as ContextLensEvent & {
      participantActivity?: { waitingAudience?: AgentChatWaitingAudience };
    }
  ).participantActivity?.waitingAudience;
  if (projectedAudience) return projectedAudience;

  const items = event.lens.activity?.items ?? [];
  if (
    items.some((item) => item.kind === 'approval' && item.status === 'waiting')
  ) {
    return 'owner';
  }
  if (
    items.some(
      (item) => item.kind === 'request_input' && item.status === 'waiting'
    ) ||
    event.lens.activity?.plan?.steps.some((step) => step.status === 'waiting')
  ) {
    return 'requester';
  }
  return null;
}

export function agentChatWaitingLabel(event: ContextLensEvent) {
  return agentChatWaitingAudience(event) === 'owner'
    ? 'Waiting for approval'
    : 'Waiting on you';
}

/**
 * Card visibility is driven only by structured run evidence. Reply prose is
 * intentionally absent: the same event sequence always yields the same UI.
 */
export function shouldShowAgentChatRun(event: ContextLensEvent) {
  return (
    hasStructuredAgentChatEvidence(event) ||
    TERMINAL_FEEDBACK_STATUSES.has(effectiveLensStatus(event.lens))
  );
}
