import {
  MAX_PARTICIPANT_AGENT_ACTIVITY_BYTES,
  MAX_PARTICIPANT_AGENT_ACTIVITY_STEPS,
  MAX_PARTICIPANT_AGENT_ACTIVITY_TITLE_CHARS,
  MAX_PARTICIPANT_AGENT_ACTIVITY_UPDATE_CHARS,
  type ParticipantAgentActivityProjectionV1,
  ParticipantAgentActivityProjectionV1Schema,
  type ParticipantAgentActivityState,
  type ParticipantAgentActivityStep,
  type ParticipantAgentActivityStepStatus,
} from '@tloncorp/api/client/participantAgentActivity';
import type {
  ContextLensActivityItem,
  ContextLensActivityStatus,
} from '@tloncorp/api/urbit/lens';
import { createHash } from 'node:crypto';

import type { ContextLens } from './context-lens.js';

const PUBLIC_ID_DOMAIN = 'tlon-participant-agent-activity-v1';

export type BuildParticipantAgentActivityProjectionOptions = {
  lens: ContextLens;
  surface: ParticipantAgentActivityProjectionV1['surface'];
  /** Monotonic revision allocated by the eventual carrier/final publisher. */
  revision: number;
  /** Explicit delivery result when it is more current than the Lens snapshot. */
  outcome?: 'completed' | 'failed' | 'cancelled';
};

function opaqueId(kind: 'run' | 'step', value: string): string {
  const digest = createHash('sha256')
    .update(PUBLIC_ID_DOMAIN)
    .update('\0')
    .update(kind)
    .update('\0')
    .update(value)
    .digest('base64url')
    .slice(0, 22);
  return `${kind}_${digest}`;
}

/** Stable public identity that cannot be used as an owner Lens lookup key. */
export function participantAgentPublicRunId(lensId: string): string {
  return opaqueId('run', lensId);
}

/** The exact thread parent used by outbound delivery and public correlation. */
export function participantAgentDeliveryParentId(
  lens: ContextLens
): string | undefined {
  return (
    lens.retrySeed?.replyParentId?.trim() ||
    (lens.retrySeed?.isThreadReply
      ? lens.retrySeed.parentId?.trim() || undefined
      : undefined)
  );
}

function compactPublicText(
  value: unknown,
  maxChars: number
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const withoutControls = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f ? ' ' : character;
  }).join('');
  const compact = withoutControls.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return undefined;
  }
  return compact.length <= maxChars
    ? compact
    : `${compact.slice(0, Math.max(0, maxChars - 1))}…`;
}

function safeTimestamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.trunc(value)));
}

function publicStepStatus(
  status: ContextLensActivityStatus
): ParticipantAgentActivityStepStatus {
  switch (status) {
    case 'running':
      return 'running';
    case 'waiting':
      return 'waiting';
    case 'completed':
      return 'completed';
    case 'error':
    case 'blocked':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'pending':
    case 'unknown':
      return 'pending';
  }
}

function isWaitingForOwner(lens: ContextLens): boolean {
  return lens.activity.items.some(
    (item) => item.kind === 'approval' && item.status === 'waiting'
  );
}

function isWaitingForRequester(lens: ContextLens): boolean {
  return (
    lens.activity.items.some(
      (item) => item.kind === 'request_input' && item.status === 'waiting'
    ) ||
    Boolean(lens.activity.plan?.steps.some((step) => step.status === 'waiting'))
  );
}

function hasFailedPlanStep(lens: ContextLens): boolean {
  return Boolean(
    lens.activity.plan?.steps.some(
      (step) => step.status === 'error' || step.status === 'blocked'
    )
  );
}

function hasIncompletePlanStep(lens: ContextLens): boolean {
  return Boolean(
    lens.activity.plan?.steps.some((step) => step.status !== 'completed')
  );
}

function projectionState(
  lens: ContextLens,
  surface: ParticipantAgentActivityProjectionV1['surface'],
  outcome?: 'completed' | 'failed' | 'cancelled'
): ParticipantAgentActivityState {
  if (outcome === 'cancelled') {
    return 'cancelled';
  }
  if (outcome === 'failed') {
    return 'failed';
  }
  if (lens.lifecycle.timedOut || lens.status === 'timed_out') {
    return 'timed_out';
  }
  if (lens.status === 'error') {
    return 'failed';
  }
  if (lens.status === 'aborted') {
    return 'cancelled';
  }

  const waitingOwner = isWaitingForOwner(lens);
  const waitingRequester = isWaitingForRequester(lens);
  if (waitingOwner) {
    return 'waiting_owner';
  }
  if (waitingRequester) {
    return 'waiting_requester';
  }

  const deliverySettlesSnapshot =
    surface === 'final' || outcome === 'completed';
  if (deliverySettlesSnapshot || lens.status === 'completed') {
    if (hasFailedPlanStep(lens)) {
      return 'failed';
    }
    return hasIncompletePlanStep(lens) ? 'incomplete' : 'completed';
  }
  if (lens.status === 'no_reply') {
    return 'incomplete';
  }
  return 'working';
}

function actionAggregate(items: ContextLensActivityItem[]) {
  const actions = items.filter(
    (item) => item.kind !== 'commentary' && item.kind !== 'request_input'
  );
  if (actions.length === 0) {
    return undefined;
  }
  return {
    total: Math.min(10_000, actions.length),
    completed: Math.min(
      10_000,
      actions.filter((item) => item.status === 'completed').length
    ),
  };
}

function latestCommentaryUpdate(
  items: ContextLensActivityItem[],
  title: string
): string | undefined {
  // `commentary` is the host's user-facing preamble for this conversation,
  // not assistant text, raw thinking, command output, approval text, or tool
  // results. registerContextLensAgentEvents deliberately excludes those
  // private/high-volume streams; widening that contract requires a separate
  // public-audience review before this allowlist may copy the new content.
  const commentary = items
    .filter((item) => item.kind === 'commentary')
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
  const update = compactPublicText(
    commentary?.progressText ?? commentary?.title,
    MAX_PARTICIPANT_AGENT_ACTIVITY_UPDATE_CHARS
  );
  return update && update !== title ? update : undefined;
}

function settleStepStatus(
  status: ParticipantAgentActivityStepStatus,
  state: ParticipantAgentActivityState
): ParticipantAgentActivityStepStatus {
  if (state === 'waiting_owner' || state === 'waiting_requester') {
    return status === 'running' ? 'waiting' : status;
  }
  if (state === 'failed' || state === 'timed_out') {
    return status === 'running' || status === 'waiting' ? 'failed' : status;
  }
  if (state === 'cancelled') {
    return status === 'running' || status === 'waiting' ? 'cancelled' : status;
  }
  if (state === 'incomplete') {
    // A terminal incomplete receipt must not leave a row visually spinning.
    return status === 'running' || status === 'waiting' ? 'pending' : status;
  }
  return status;
}

function planSteps(
  lens: ContextLens,
  publicRunId: string,
  state: ParticipantAgentActivityState
): ParticipantAgentActivityStep[] {
  const plan = lens.activity.plan;
  if (!plan?.steps.length) {
    return [];
  }
  return plan.steps
    .slice(0, MAX_PARTICIPANT_AGENT_ACTIVITY_STEPS)
    .flatMap((step, index) => {
      const title = compactPublicText(
        step.title,
        MAX_PARTICIPANT_AGENT_ACTIVITY_TITLE_CHARS
      );
      if (!title) {
        return [];
      }
      const stepItems = lens.activity.items.filter(
        (item) => item.planStepId === step.id
      );
      const update = latestCommentaryUpdate(stepItems, title);
      const actions = actionAggregate(stepItems);
      return [
        {
          id: opaqueId('step', `${publicRunId}\0${step.id || index}`),
          title,
          status: settleStepStatus(publicStepStatus(step.status), state),
          ...(update ? { update } : {}),
          ...(actions ? { actions } : {}),
        },
      ];
    });
}

function fallbackSteps(
  lens: ContextLens,
  publicRunId: string,
  state: ParticipantAgentActivityState
): ParticipantAgentActivityStep[] {
  const requestInput = [...lens.activity.items]
    .reverse()
    .find((item) => item.kind === 'request_input');
  if (requestInput) {
    const title = compactPublicText(
      requestInput.title,
      MAX_PARTICIPANT_AGENT_ACTIVITY_TITLE_CHARS
    );
    if (title) {
      return [
        {
          id: opaqueId(
            'step',
            `${publicRunId}\0${requestInput.id || 'request-input'}`
          ),
          title,
          status: settleStepStatus(
            publicStepStatus(requestInput.status),
            state
          ),
        },
      ];
    }
  }

  const commentary = lens.activity.items
    .filter((item) => item.kind === 'commentary')
    .slice(-MAX_PARTICIPANT_AGENT_ACTIVITY_STEPS);
  if (commentary.length > 0) {
    return commentary.flatMap((item, index) => {
      const progress = compactPublicText(
        item.progressText,
        MAX_PARTICIPANT_AGENT_ACTIVITY_TITLE_CHARS
      );
      const itemTitle = compactPublicText(
        item.title,
        MAX_PARTICIPANT_AGENT_ACTIVITY_TITLE_CHARS
      );
      const title = progress ?? itemTitle;
      if (!title) {
        return [];
      }
      const update =
        progress && itemTitle && itemTitle !== progress ? progress : undefined;
      return [
        {
          id: opaqueId(
            'step',
            `${publicRunId}\0${item.id || `commentary-${index}`}`
          ),
          title,
          status: settleStepStatus(publicStepStatus(item.status), state),
          ...(update ? { update } : {}),
          ...(index === commentary.length - 1
            ? { actions: actionAggregate(lens.activity.items) }
            : {}),
        },
      ];
    });
  }

  const status: ParticipantAgentActivityStepStatus =
    state === 'completed'
      ? 'completed'
      : state === 'failed' || state === 'timed_out'
        ? 'failed'
        : state === 'cancelled'
          ? 'cancelled'
          : state === 'waiting_owner' || state === 'waiting_requester'
            ? 'waiting'
            : state === 'incomplete'
              ? 'pending'
              : 'running';
  const actions = actionAggregate(lens.activity.items);
  return [
    {
      id: opaqueId('step', `${publicRunId}\0generic`),
      title: 'Working on your request',
      status,
      ...(actions ? { actions } : {}),
    },
  ];
}

function serializedBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function fitProjection(
  projection: ParticipantAgentActivityProjectionV1
): ParticipantAgentActivityProjectionV1 {
  const fitted: ParticipantAgentActivityProjectionV1 = {
    ...projection,
    steps: projection.steps.map((step) => ({ ...step })),
  };
  while (serializedBytes(fitted) > MAX_PARTICIPANT_AGENT_ACTIVITY_BYTES) {
    const stepWithUpdate = [...fitted.steps]
      .reverse()
      .find((step) => step.update !== undefined);
    if (stepWithUpdate) {
      delete stepWithUpdate.update;
      continue;
    }
    if (fitted.steps.length > 1) {
      fitted.steps.pop();
      continue;
    }
    break;
  }
  return fitted;
}

function genericTerminalReason(
  lens: ContextLens,
  state: ParticipantAgentActivityState
): ParticipantAgentActivityProjectionV1['terminalReason'] {
  if (state === 'timed_out') {
    return 'timeout';
  }
  if (state === 'cancelled') {
    return 'interrupted';
  }
  if (state === 'failed') {
    const approvalDenied = lens.activity.items.some(
      (item) =>
        item.kind === 'approval' &&
        (item.status === 'error' ||
          item.status === 'blocked' ||
          item.status === 'cancelled')
    );
    return approvalDenied ? 'denied' : 'failed';
  }
  return undefined;
}

/**
 * Build the only Lens-derived payload that may be copied into a group post.
 * This is intentionally an allowlist: adding a field to ContextLens never
 * makes it public without an explicit mapping here.
 */
export function buildParticipantAgentActivityProjection({
  lens,
  surface,
  revision,
  outcome,
}: BuildParticipantAgentActivityProjectionOptions): ParticipantAgentActivityProjectionV1 | null {
  if (
    lens.chatType !== 'channel' ||
    lens.triggerDetails.conversationKind !== 'channel'
  ) {
    return null;
  }

  const triggerPostId = compactPublicText(
    lens.triggerDetails.messageId || lens.messageId,
    320
  );
  if (!triggerPostId) {
    return null;
  }

  const publicRunId = participantAgentPublicRunId(lens.lensId);
  const state = projectionState(lens, surface, outcome);
  const createdAt = safeTimestamp(lens.createdAt);
  const rawCompletedAt = safeTimestamp(
    lens.lifecycle.completedAt ?? lens.updatedAt
  );
  const isTerminal =
    state === 'completed' ||
    state === 'incomplete' ||
    state === 'failed' ||
    state === 'timed_out' ||
    state === 'cancelled';
  const completedAt = isTerminal
    ? Math.max(createdAt, rawCompletedAt)
    : undefined;
  const updatedAt = Math.max(
    createdAt,
    safeTimestamp(lens.updatedAt),
    completedAt ?? 0
  );
  const threadRootId = compactPublicText(
    participantAgentDeliveryParentId(lens),
    320
  );
  const steps = planSteps(lens, publicRunId, state);
  const terminalReason = genericTerminalReason(lens, state);

  const projection: ParticipantAgentActivityProjectionV1 = {
    schemaVersion: 1,
    surface,
    publicRunId,
    revision,
    triggerPostId,
    ...(threadRootId ? { threadRootId } : {}),
    ...(lens.retryOf
      ? { retryOf: participantAgentPublicRunId(lens.retryOf) }
      : {}),
    ...(lens.continuation?.kind === 'request_input'
      ? {
          continuation: {
            kind: 'request_input' as const,
            parentPublicRunId: participantAgentPublicRunId(
              lens.continuation.parentLensId
            ),
          },
        }
      : {}),
    state,
    createdAt,
    updatedAt,
    ...(completedAt !== undefined ? { completedAt } : {}),
    steps: steps.length ? steps : fallbackSteps(lens, publicRunId, state),
    ...(terminalReason ? { terminalReason } : {}),
  };

  return ParticipantAgentActivityProjectionV1Schema.parse(
    fitProjection(projection)
  );
}
