import type {
  ContextLensActivity,
  ContextLensActivityEvent,
  ContextLensActivityItem,
  ContextLensActivityPlan,
  ContextLensActivityPlanStep,
  ContextLensActivityStatus,
} from '@tloncorp/api/urbit/lens';
import type { PluginAgentEventSubscriptionRegistration } from 'openclaw/plugin-sdk/core';

import {
  TLON_REQUEST_INPUT_EVENT_STREAM,
  TLON_REQUEST_INPUT_TOOL_NAME,
} from './tlon-request-input.js';

export type {
  ContextLensActivity,
  ContextLensActivityEvent,
  ContextLensActivityItem,
  ContextLensActivityKind,
  ContextLensActivityPlan,
  ContextLensActivityPlanStep,
  ContextLensActivityStatus,
} from '@tloncorp/api/urbit/lens';

export const CONTEXT_LENS_ACTIVITY_SCHEMA_VERSION = 1;
export const DEFAULT_MAX_CONTEXT_LENS_ACTIVITY_ITEMS = 80;

const MAX_LABEL_CHARS = 240;
const MAX_PROGRESS_CHARS = 2_000;
const MAX_PLAN_STEPS = 50;

type OpenClawAgentEvent = Parameters<
  PluginAgentEventSubscriptionRegistration['handle']
>[0];

export function emptyContextLensActivity(): ContextLensActivity {
  return {
    schemaVersion: CONTEXT_LENS_ACTIVITY_SCHEMA_VERSION,
    eventCount: 0,
    lastEventAt: null,
    truncated: false,
    plan: null,
    items: [],
  };
}

function readString(
  value: unknown,
  maxChars = MAX_LABEL_CHARS
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return undefined;
  }
  return compact.length <= maxChars
    ? compact
    : `${compact.slice(0, Math.max(0, maxChars - 1))}…`;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeStatus(
  value: unknown,
  phase: string
): ContextLensActivityStatus {
  const status = readString(value, 40)?.toLowerCase();
  if (status === 'pending' || status === 'queued') {
    return 'pending';
  }
  if (status === 'running' || status === 'in_progress') {
    return 'running';
  }
  if (status === 'inprogress') {
    return 'running';
  }
  if (status === 'waiting' || status === 'requested') {
    return 'waiting';
  }
  if (status === 'completed' || status === 'success' || status === 'approved') {
    return 'completed';
  }
  if (status === 'error' || status === 'failed' || status === 'denied') {
    return 'error';
  }
  if (status === 'blocked' || status === 'unavailable') {
    return 'blocked';
  }
  if (
    status === 'cancelled' ||
    status === 'canceled' ||
    status === 'abandoned'
  ) {
    return 'cancelled';
  }
  if (phase === 'start' || phase === 'update' || phase === 'delta') {
    return 'running';
  }
  if (phase === 'requested') {
    return 'waiting';
  }
  if (phase === 'error') {
    return 'error';
  }
  if (phase === 'end' || phase === 'result' || phase === 'resolved') {
    return 'completed';
  }
  return 'unknown';
}

function normalizePlan(
  data: Record<string, unknown>,
  occurredAt: number
): ContextLensActivityPlan {
  const rawSteps = Array.isArray(data.steps) ? data.steps : [];
  const steps = rawSteps.slice(0, MAX_PLAN_STEPS).flatMap((value, index) => {
    if (typeof value === 'string') {
      const compact = readString(value);
      if (!compact) {
        return [];
      }
      const statusSuffix = compact.match(/^(.*?)\s+\(([^()]+)\)$/);
      const title = readString(statusSuffix?.[1] ?? compact);
      if (!title) {
        return [];
      }
      return [
        {
          id: `plan-step-${index + 1}`,
          title,
          status: statusSuffix
            ? normalizeStatus(statusSuffix[2], 'update')
            : index === 0
              ? ('running' as const)
              : ('pending' as const),
        },
      ];
    }
    if (!value || typeof value !== 'object') {
      return [];
    }
    const step = value as Record<string, unknown>;
    const title = readString(step.step ?? step.title ?? step.text);
    if (!title) {
      return [];
    }
    return [
      {
        id: readString(step.id, 120) ?? `plan-step-${index + 1}`,
        title,
        status: normalizeStatus(step.status, 'update'),
      },
    ];
  });
  return {
    ...(readString(data.title) ? { title: readString(data.title) } : {}),
    ...(readString(data.explanation, MAX_PROGRESS_CHARS)
      ? { explanation: readString(data.explanation, MAX_PROGRESS_CHARS) }
      : {}),
    steps,
    updatedAt: occurredAt,
  };
}

const POSITIONAL_PLAN_STEP_ID = /^plan-step-\d+$/;

function normalizedPlanTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function planTitleSimilarity(left: string, right: string) {
  const leftTokens = new Set(
    normalizedPlanTitle(left).split(' ').filter(Boolean)
  );
  const rightTokens = new Set(
    normalizedPlanTitle(right).split(' ').filter(Boolean)
  );
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

function semanticPlanStepId(title: string, occupied: Set<string>) {
  const normalized = normalizedPlanTitle(title) || 'step';
  const slug = normalized.split(' ').slice(0, 5).join('-').slice(0, 64);
  let hash = 2_166_136_261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  const base = `plan-step-${slug}-${(hash >>> 0).toString(36)}`;
  let id = base;
  let suffix = 2;
  while (occupied.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

/**
 * OpenClaw 7.1 omits plan-step IDs, so normalization supplies positional IDs.
 * Reconcile those revisions by content before folding them into the durable
 * snapshot; inserting a new first step must not move existing activity to it.
 */
function reconcilePlanRevision(
  previous: ContextLensActivityPlan | null,
  incoming: ContextLensActivityPlan
): ContextLensActivityPlan {
  if (!previous?.steps.length || !incoming.steps.length) return incoming;

  const previousById = new Map(previous.steps.map((step) => [step.id, step]));
  const previousIds = new Set(previousById.keys());
  const claimedPreviousIds = new Set<string>();
  const reconciled: Array<ContextLensActivityPlanStep | null> =
    incoming.steps.map((step) => {
      if (POSITIONAL_PLAN_STEP_ID.test(step.id)) return null;
      const previousStep = previousById.get(step.id);
      if (previousStep) claimedPreviousIds.add(previousStep.id);
      return step;
    });

  for (let index = 0; index < incoming.steps.length; index += 1) {
    if (reconciled[index]) continue;
    const incomingStep = incoming.steps[index];
    const title = normalizedPlanTitle(incomingStep.title);
    const exact = previous.steps.find(
      (candidate) =>
        !claimedPreviousIds.has(candidate.id) &&
        normalizedPlanTitle(candidate.title) === title
    );
    if (!exact) continue;
    claimedPreviousIds.add(exact.id);
    reconciled[index] = { ...incomingStep, id: exact.id };
  }

  const fuzzyMatches = incoming.steps.flatMap((incomingStep, incomingIndex) => {
    if (reconciled[incomingIndex]) return [];
    return previous.steps.flatMap((previousStep, previousIndex) => {
      if (claimedPreviousIds.has(previousStep.id)) return [];
      const score = planTitleSimilarity(incomingStep.title, previousStep.title);
      return score >= 0.62
        ? [{ incomingIndex, previousIndex, previousStep, score }]
        : [];
    });
  });
  fuzzyMatches.sort(
    (left, right) =>
      right.score - left.score ||
      Math.abs(left.incomingIndex - left.previousIndex) -
        Math.abs(right.incomingIndex - right.previousIndex)
  );
  for (const match of fuzzyMatches) {
    if (
      reconciled[match.incomingIndex] ||
      claimedPreviousIds.has(match.previousStep.id)
    ) {
      continue;
    }
    claimedPreviousIds.add(match.previousStep.id);
    reconciled[match.incomingIndex] = {
      ...incoming.steps[match.incomingIndex],
      id: match.previousStep.id,
    };
  }

  const occupied = new Set([
    ...previousIds,
    ...reconciled.flatMap((step) => (step ? [step.id] : [])),
  ]);
  const steps = reconciled.map((step, index) => {
    if (step) return step;
    const incomingStep = incoming.steps[index];
    const id =
      !previousIds.has(incomingStep.id) && !occupied.has(incomingStep.id)
        ? incomingStep.id
        : semanticPlanStepId(incomingStep.title, occupied);
    occupied.add(id);
    return { ...incomingStep, id };
  });

  return { ...incoming, steps };
}

function activityKindForItem(
  data: Record<string, unknown>
): ContextLensActivityEvent['kind'] {
  const kind = readString(data.kind, 80);
  if (kind === 'preamble') {
    return 'commentary';
  }
  if (
    kind === 'tool' ||
    kind === 'approval' ||
    kind === 'command' ||
    kind === 'patch' ||
    kind === 'compaction'
  ) {
    return kind;
  }
  return 'item';
}

/**
 * Normalize the host-owned, sanitized agent event into the stable Lens/UI
 * contract. Unsupported streams return null. In particular, `thinking` is
 * deliberately excluded and can be added later as an opt-in ephemeral stream.
 */
export function normalizeContextLensActivityEvent(
  event: OpenClawAgentEvent
): ContextLensActivityEvent | null {
  const data = event.data;
  const phase = readString(data.phase, 80) ?? 'update';
  const common = {
    schemaVersion: CONTEXT_LENS_ACTIVITY_SCHEMA_VERSION,
    runId: event.runId,
    sequence: event.seq,
    occurredAt: event.ts,
    phase,
  } as const;

  if (event.stream === 'assistant' || event.stream === 'thinking') {
    return null;
  }

  if (event.stream === TLON_REQUEST_INPUT_EVENT_STREAM) {
    const title = readString(data.title);
    if (!title) {
      return null;
    }
    const toolCallId = readString(data.toolCallId, 160);
    return {
      ...common,
      kind: 'request_input',
      retention: 'snapshot',
      itemId:
        readString(data.itemId, 160) ??
        `request-input:${toolCallId ?? event.seq}`,
      title,
      status: 'waiting',
      source: TLON_REQUEST_INPUT_TOOL_NAME,
      ...(toolCallId ? { toolCallId } : {}),
    };
  }

  if (event.stream === 'codex_app_server.item') {
    const itemId = readString(data.itemId, 160);
    if (phase !== 'completed' || data.type !== 'agentMessage' || !itemId) {
      return null;
    }
    return {
      ...common,
      kind: 'item',
      retention: 'snapshot',
      itemId,
      status: 'completed',
      source: 'codex-app-server-completion',
    };
  }

  if (event.stream === 'lifecycle') {
    return {
      ...common,
      kind: 'lifecycle',
      retention: 'snapshot',
      status: normalizeStatus(data.status ?? data.livenessState, phase),
      ...(readString(data.error, MAX_PROGRESS_CHARS)
        ? { progressText: readString(data.error, MAX_PROGRESS_CHARS) }
        : {}),
    };
  }

  if (event.stream === 'plan') {
    return {
      ...common,
      kind: 'plan',
      retention: 'snapshot',
      plan: normalizePlan(data, event.ts),
    };
  }

  if (event.stream === 'item') {
    const kind = activityKindForItem(data);
    const itemId = readString(data.itemId, 160);
    return {
      ...common,
      kind,
      retention: 'snapshot',
      ...(itemId ? { itemId } : {}),
      ...(readString(data.title) ? { title: readString(data.title) } : {}),
      status: normalizeStatus(data.status, phase),
      ...(readString(data.progressText, MAX_PROGRESS_CHARS)
        ? { progressText: readString(data.progressText, MAX_PROGRESS_CHARS) }
        : {}),
      ...(readString(data.name, 120)
        ? { name: readString(data.name, 120) }
        : {}),
      ...(readString(data.toolCallId, 160)
        ? { toolCallId: readString(data.toolCallId, 160) }
        : {}),
      ...(readString(data.source, 120)
        ? { source: readString(data.source, 120) }
        : {}),
    };
  }

  if (event.stream === 'tool') {
    const itemId = readString(data.itemId, 160);
    const toolCallId = readString(data.toolCallId, 160);
    const name = readString(data.name, 120);
    // tlon_request_input has its own explicit waiting event. Treating its
    // ordinary host tool lifecycle as work would add a duplicate action and
    // close the requester gate as soon as the no-op tool returns.
    if (name === TLON_REQUEST_INPUT_TOOL_NAME) {
      return null;
    }
    return {
      ...common,
      kind: 'tool',
      retention: 'snapshot',
      ...(itemId
        ? { itemId }
        : toolCallId
          ? { itemId: `tool:${toolCallId}` }
          : {}),
      ...(toolCallId ? { toolCallId } : {}),
      ...(name ? { name, title: name } : {}),
      status: normalizeStatus(
        data.isError === true ? 'error' : data.status,
        phase
      ),
      ...(readString(data.progressText ?? data.error, MAX_PROGRESS_CHARS)
        ? {
            progressText: readString(
              data.progressText ?? data.error,
              MAX_PROGRESS_CHARS
            ),
          }
        : {}),
    };
  }

  if (event.stream === 'approval') {
    const canonicalItemId = readString(data.itemId, 160);
    const fallbackItemId = readString(data.approvalId ?? data.toolCallId, 160);
    return {
      ...common,
      kind: 'approval',
      retention: 'snapshot',
      ...(canonicalItemId
        ? { itemId: canonicalItemId }
        : fallbackItemId
          ? { itemId: `approval:${fallbackItemId}` }
          : {}),
      ...(readString(data.title) ? { title: readString(data.title) } : {}),
      status: normalizeStatus(data.status, phase),
      ...(readString(data.message ?? data.reason, MAX_PROGRESS_CHARS)
        ? {
            progressText: readString(
              data.message ?? data.reason,
              MAX_PROGRESS_CHARS
            ),
          }
        : {}),
    };
  }

  if (event.stream === 'patch') {
    const canonicalItemId = readString(data.itemId, 160);
    const toolCallId = readString(data.toolCallId, 160);
    const counts = {
      ...(readNumber(data.added) !== undefined
        ? { added: readNumber(data.added) }
        : {}),
      ...(readNumber(data.modified) !== undefined
        ? { modified: readNumber(data.modified) }
        : {}),
      ...(readNumber(data.deleted) !== undefined
        ? { deleted: readNumber(data.deleted) }
        : {}),
    };
    return {
      ...common,
      kind: 'patch',
      retention: 'snapshot',
      ...(canonicalItemId
        ? { itemId: canonicalItemId }
        : toolCallId
          ? { itemId: `patch:${toolCallId}` }
          : {}),
      ...(toolCallId ? { toolCallId } : {}),
      title: readString(data.title) ?? 'Files changed',
      status: normalizeStatus(data.status, phase),
      ...(readString(data.summary, MAX_PROGRESS_CHARS)
        ? { progressText: readString(data.summary, MAX_PROGRESS_CHARS) }
        : {}),
      ...(Object.keys(counts).length > 0 ? { counts } : {}),
    };
  }

  if (event.stream === 'command_output') {
    const canonicalItemId = readString(data.itemId, 160);
    const toolCallId = readString(data.toolCallId, 160);
    return {
      ...common,
      kind: 'command',
      // Command output is useful live but is deliberately absent from the
      // durable Lens snapshot; it can contain high-volume or sensitive text.
      retention: 'ephemeral',
      ...(canonicalItemId
        ? { itemId: canonicalItemId }
        : toolCallId
          ? { itemId: `command:${toolCallId}` }
          : {}),
      ...(toolCallId ? { toolCallId } : {}),
      ...(readString(data.title) ? { title: readString(data.title) } : {}),
      status: normalizeStatus(data.status, phase),
      ...(readString(data.output, MAX_PROGRESS_CHARS)
        ? { progressText: readString(data.output, MAX_PROGRESS_CHARS) }
        : {}),
    };
  }

  if (event.stream === 'compaction') {
    return {
      ...common,
      kind: 'compaction',
      retention: 'snapshot',
      itemId: 'compaction',
      title: 'Compact context',
      status: normalizeStatus(data.status, phase),
      ...(readString(data.summary ?? data.reason, MAX_PROGRESS_CHARS)
        ? {
            progressText: readString(
              data.summary ?? data.reason,
              MAX_PROGRESS_CHARS
            ),
          }
        : {}),
    };
  }

  if (event.stream === 'error') {
    return {
      ...common,
      kind: 'error',
      retention: 'snapshot',
      itemId: readString(data.itemId, 160) ?? `error:${event.seq}`,
      title: readString(data.title) ?? 'Run error',
      status: 'error',
      ...(readString(data.message ?? data.error, MAX_PROGRESS_CHARS)
        ? {
            progressText: readString(
              data.message ?? data.error,
              MAX_PROGRESS_CHARS
            ),
          }
        : {}),
    };
  }

  return null;
}

function isTerminalActivityStatus(status: ContextLensActivityStatus) {
  return (
    status === 'completed' ||
    status === 'error' ||
    status === 'blocked' ||
    status === 'cancelled'
  );
}

function activePlanStepId(plan: ContextLensActivityPlan | null) {
  return (
    plan?.steps.find(
      (step) => step.status === 'running' || step.status === 'waiting'
    )?.id ??
    plan?.steps.find(
      (step) => step.status === 'pending' || step.status === 'unknown'
    )?.id
  );
}

/** Fold one normalized event into the bounded, durable run snapshot. */
export function foldContextLensActivity(
  activity: ContextLensActivity,
  event: ContextLensActivityEvent,
  maxItems = DEFAULT_MAX_CONTEXT_LENS_ACTIVITY_ITEMS
): ContextLensActivity {
  if (event.retention === 'ephemeral') {
    return activity;
  }

  const base: ContextLensActivity = {
    ...activity,
    eventCount: activity.eventCount + 1,
    lastEventAt: event.occurredAt,
  };
  if (event.kind === 'plan') {
    return {
      ...base,
      plan: event.plan
        ? reconcilePlanRevision(activity.plan, event.plan)
        : activity.plan,
    };
  }
  if (event.kind === 'lifecycle') {
    if (!event.status || !isTerminalActivityStatus(event.status)) {
      return base;
    }
    const terminalStatus = event.status;
    const closeStatus = (status: ContextLensActivityStatus) =>
      status === 'running' || status === 'waiting' || status === 'unknown';
    return {
      ...base,
      plan: activity.plan
        ? {
            ...activity.plan,
            updatedAt: event.occurredAt,
            steps: activity.plan.steps.map((step) =>
              closeStatus(step.status)
                ? { ...step, status: terminalStatus }
                : step
            ),
          }
        : null,
      items: activity.items.map((item) =>
        closeStatus(item.status) &&
        !(
          terminalStatus === 'completed' &&
          item.kind === 'request_input' &&
          item.status === 'waiting'
        )
          ? {
              ...item,
              status: terminalStatus,
              updatedAt: event.occurredAt,
              completedAt: event.occurredAt,
            }
          : item
      ),
    };
  }

  const id =
    event.itemId ??
    `${event.kind}:${event.toolCallId ?? event.name ?? event.sequence}`;
  const existingIndex = activity.items.findIndex((item) => item.id === id);
  const existing =
    existingIndex >= 0 ? activity.items[existingIndex] : undefined;
  // The app-server completion marker intentionally carries no message text or
  // assistant phase. It may close a commentary item we already observed, but
  // must not turn the final assistant answer into a generic activity row.
  if (event.source === 'codex-app-server-completion' && !existing) {
    return base;
  }
  const items =
    event.kind === 'commentary' && !existing
      ? activity.items.map((candidate) =>
          candidate.kind === 'commentary' &&
          !isTerminalActivityStatus(candidate.status)
            ? {
                ...candidate,
                status: 'completed' as const,
                updatedAt: event.occurredAt,
                completedAt: event.occurredAt,
              }
            : candidate
        )
      : activity.items;
  const index = items.findIndex((item) => item.id === id);
  const status = event.status ?? existing?.status ?? 'unknown';
  const item: ContextLensActivityItem = {
    id,
    kind:
      existing?.kind === 'commentary' && event.kind === 'item'
        ? 'commentary'
        : event.kind,
    title:
      event.title ??
      existing?.title ??
      event.name ??
      (event.kind === 'commentary' ? 'Progress' : 'Activity'),
    status,
    ...(existing?.planStepId ?? activePlanStepId(activity.plan)
      ? {
          planStepId: existing?.planStepId ?? activePlanStepId(activity.plan),
        }
      : {}),
    startedAt: existing?.startedAt ?? event.occurredAt,
    updatedAt: event.occurredAt,
    completedAt: isTerminalActivityStatus(status)
      ? event.occurredAt
      : existing?.completedAt ?? null,
    ...(event.progressText ?? existing?.progressText
      ? { progressText: event.progressText ?? existing?.progressText }
      : {}),
    ...(event.name ?? existing?.name
      ? { name: event.name ?? existing?.name }
      : {}),
    ...(event.toolCallId ?? existing?.toolCallId
      ? { toolCallId: event.toolCallId ?? existing?.toolCallId }
      : {}),
    ...(event.source ?? existing?.source
      ? { source: event.source ?? existing?.source }
      : {}),
    ...(event.counts ?? existing?.counts
      ? { counts: event.counts ?? existing?.counts }
      : {}),
  };
  const nextItems =
    index >= 0
      ? items.map((candidate, itemIndex) =>
          itemIndex === index ? item : candidate
        )
      : [...items, item];
  const overflow = Math.max(0, nextItems.length - maxItems);
  return {
    ...base,
    truncated: activity.truncated || overflow > 0,
    items: overflow > 0 ? nextItems.slice(overflow) : nextItems,
  };
}
