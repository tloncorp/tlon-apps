import type {
  ContextLensActivity,
  ContextLensActivityEvent,
  ContextLensActivityItem,
  ContextLensActivityStatus,
} from '@tloncorp/api/urbit/lens';

import type {
  AgentTaskDetail,
  AgentTaskRow,
  AgentTaskStatus,
} from './AgentTaskRows';
import { isStructuredWaitingActivityItem } from './activitySemantics';

export type AgentTaskRowsModel = {
  rows: AgentTaskRow[];
  autoExpandedId?: string;
};

export function compactWaitingTaskRows(rows: readonly AgentTaskRow[]) {
  const waitingRow = rows.find((row) => row.status === 'waiting');
  return {
    rows: waitingRow ? [waitingRow] : rows.slice(0, 1),
    queuedCount: rows.filter((row) => row.status === 'pending').length,
    hiddenCount: Math.max(0, rows.length - 1),
  };
}

export type AgentTaskToolRun = {
  id: string;
  toolCallId?: string;
  name: string;
  status: 'running' | 'completed' | 'error' | 'blocked';
  startedAt: number;
  completedAt: number | null;
  durationMs: number | null;
  argumentSummary?: string;
  argumentDetail?: string;
  resultSummary?: string;
  error?: string;
};

export type AgentTaskRowsOptions = {
  toolRuns?: readonly AgentTaskToolRun[];
  /** Detailed tool input is owner-only; participant views use summaries. */
  includeToolArguments?: boolean;
  /** Final run truth closes stale provider activity without changing history. */
  runOutcome?:
    | 'active'
    | 'completed'
    | 'incomplete'
    | 'unavailable'
    | 'waiting'
    | 'failed';
  /** Chat is a concise plan projection; inspector preserves the debug detail. */
  presentation?: 'chat' | 'inspector';
  /** Terminal provider error shown on the task that actually failed. */
  failureMessage?: string | null;
  /** Requester input and owner approval gates use different public copy. */
  waitingLabel?: AgentTaskRow['waitingLabel'];
};

function taskStatus(status: ContextLensActivityStatus): AgentTaskStatus {
  if (status === 'completed') return 'completed';
  if (status === 'error' || status === 'blocked' || status === 'cancelled') {
    return 'failed';
  }
  if (status === 'pending') return 'pending';
  if (status === 'waiting') return 'waiting';
  return 'running';
}

function statusText(status: ContextLensActivityStatus) {
  if (status === 'waiting') return 'Waiting';
  if (status === 'blocked') return 'Blocked';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'error') return 'Failed';
  if (status === 'unknown') return 'Working';
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function labelFromIdentifier(value: string) {
  const words = value
    .replace(/[._:/-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return words
    ? `${words.charAt(0).toUpperCase()}${words.slice(1)}`
    : 'Activity';
}

function countText(item: ContextLensActivityItem) {
  const parts = [
    item.counts?.added ? `+${item.counts.added}` : null,
    item.counts?.modified ? `~${item.counts.modified}` : null,
    item.counts?.deleted ? `−${item.counts.deleted}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function itemLabel(item: ContextLensActivityItem) {
  if (item.kind === 'commentary') return 'Update';
  if (item.kind === 'tool') return 'Tool';
  if (item.kind === 'approval') return 'Approval';
  if (item.kind === 'command') return 'Command';
  if (item.kind === 'patch') return 'Changes';
  if (item.kind === 'compaction') return 'Context';
  if (item.kind === 'error') return 'Error';
  return 'Activity';
}

function itemValue(item: ContextLensActivityItem) {
  const counts = countText(item);
  if (counts && item.progressText) return `${item.progressText} · ${counts}`;
  if (counts) return counts;
  if (item.progressText) return item.progressText;
  if (item.name) return labelFromIdentifier(item.name);
  return item.title;
}

function durationText(durationMs: number) {
  if (durationMs < 1_000) return `${Math.max(1, Math.round(durationMs))}ms`;
  if (durationMs < 10_000) return `${(durationMs / 1_000).toFixed(1)}s`;
  const seconds = Math.round(durationMs / 1_000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function itemDuration(item: ContextLensActivityItem) {
  if (item.completedAt == null) return null;
  return durationText(Math.max(0, item.completedAt - item.startedAt));
}

function compactValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 8)
      .map((entry) => {
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          if (typeof record.q === 'string') return record.q;
          if (typeof record.ref_id === 'string') return record.ref_id;
        }
        return compactValue(entry);
      })
      .filter(Boolean)
      .join('\n');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .slice(0, 8)
      .map(
        ([key, nested]) =>
          `${labelFromIdentifier(key)}: ${compactValue(nested)}`
      )
      .join('\n');
  }
  return '';
}

function toolInputDetails(detail: string): AgentTaskDetail[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(detail);
  } catch {
    return [{ label: 'Input', value: detail }];
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [{ label: 'Input', value: compactValue(parsed) }];
  }

  return Object.entries(parsed as Record<string, unknown>)
    .slice(0, 8)
    .flatMap(([key, value]) => {
      if (key === 'search_query' && Array.isArray(value)) {
        const queries = value
          .map((entry) =>
            entry && typeof entry === 'object'
              ? (entry as Record<string, unknown>).q
              : null
          )
          .filter((query): query is string => typeof query === 'string');
        return queries.length
          ? [{ label: 'Queries', value: queries.join('\n') }]
          : [];
      }
      if (key === 'open' && Array.isArray(value)) {
        return [
          {
            label: 'Sources opened',
            value: `${value.length} referenced ${value.length === 1 ? 'page' : 'pages'}`,
          },
        ];
      }
      const label =
        key === 'command'
          ? 'Command'
          : key === 'path'
            ? 'File'
            : key === 'response_length'
              ? 'Search depth'
              : labelFromIdentifier(key);
      const formatted = compactValue(value);
      return formatted ? [{ label, value: formatted }] : [];
    });
}

function toolRunForItem(
  item: ContextLensActivityItem,
  toolRuns: readonly AgentTaskToolRun[]
) {
  return toolRuns.find(
    (run) =>
      run.id === item.id ||
      run.id === item.toolCallId ||
      (run.toolCallId != null && run.toolCallId === item.toolCallId)
  );
}

function activityStatusForToolRun(
  status: AgentTaskToolRun['status']
): ContextLensActivityStatus {
  if (status === 'completed') return 'completed';
  if (status === 'blocked') return 'blocked';
  if (status === 'error') return 'error';
  return 'running';
}

function reconcileToolRun(
  item: ContextLensActivityItem,
  toolRuns: readonly AgentTaskToolRun[]
): ContextLensActivityItem {
  const run = toolRunForItem(item, toolRuns);
  if (!run) return item;
  const status = activityStatusForToolRun(run.status);
  if (taskStatus(item.status) === 'failed' && taskStatus(status) !== 'failed') {
    return item;
  }
  return {
    ...item,
    status,
    updatedAt: run.completedAt ?? item.updatedAt,
    completedAt:
      status === 'running'
        ? null
        : run.completedAt ?? item.completedAt ?? item.updatedAt,
    ...(run.error ? { progressText: run.error } : {}),
  };
}

function terminalActivityStatus(
  status: ContextLensActivityStatus,
  outcome: AgentTaskRowsOptions['runOutcome']
): ContextLensActivityStatus {
  if (!outcome || outcome === 'active') return status;
  if (
    status === 'completed' ||
    status === 'error' ||
    status === 'blocked' ||
    status === 'cancelled'
  ) {
    return status;
  }
  if (outcome === 'failed') return 'error';
  if (outcome === 'incomplete' || outcome === 'unavailable') return 'pending';
  if (status === 'pending') return 'pending';
  return outcome === 'waiting' ? 'waiting' : 'completed';
}

function isGenericReasoning(item: ContextLensActivityItem) {
  return (
    item.kind === 'item' &&
    item.title.trim().toLowerCase() === 'reasoning' &&
    !item.progressText?.trim()
  );
}

function isContextCompaction(item: ContextLensActivityItem) {
  if (item.kind === 'compaction') return true;
  if (item.kind !== 'item') return false;
  const title = item.title.trim().toLowerCase();
  return title === 'compact context' || title === 'context compaction';
}

function detailsForItem(
  item: ContextLensActivityItem,
  toolRuns: readonly AgentTaskToolRun[],
  includeToolArguments: boolean
): AgentTaskDetail[] {
  const details: AgentTaskDetail[] = [];
  if (item.kind === 'commentary') {
    details.push({
      label: 'Agent update',
      value: item.progressText ?? item.title,
    });
  } else if (item.kind === 'tool') {
    const run = toolRunForItem(item, toolRuns);
    details.push({ label: 'Action', value: fallbackTitle(item) });
    details.push({ label: 'Action status', value: statusText(item.status) });
    if (includeToolArguments && run?.argumentDetail) {
      details.push(...toolInputDetails(run.argumentDetail));
    } else if (run?.argumentSummary) {
      details.push({ label: 'Input', value: run.argumentSummary });
    }
    if (run?.resultSummary) {
      details.push({ label: 'Result', value: run.resultSummary });
    }
    if (run?.error) {
      details.push({ label: 'Error', value: run.error });
    }
    if (run?.durationMs != null) {
      details.push({ label: 'Elapsed', value: durationText(run.durationMs) });
    }
  } else if (item.title === 'Reasoning' && !item.progressText) {
    details.push({
      label: 'Activity',
      value: 'Reasoned through the next action between visible updates.',
    });
  } else {
    details.push({ label: itemLabel(item), value: itemValue(item) });
  }

  if (
    item.status === 'error' ||
    item.status === 'blocked' ||
    item.status === 'cancelled'
  ) {
    details.push({ label: 'Status', value: statusText(item.status) });
  }
  const duration = itemDuration(item);
  if (duration && !details.some((detail) => detail.label === 'Elapsed')) {
    details.push({ label: 'Elapsed', value: duration });
  }
  const changes = countText(item);
  if (changes) details.push({ label: 'Changes', value: changes });
  return details;
}

function detailsForItems(
  items: ContextLensActivityItem[],
  fallbackStatus: ContextLensActivityStatus,
  toolRuns: readonly AgentTaskToolRun[],
  includeToolArguments: boolean,
  explanation?: string
): AgentTaskDetail[] {
  const details = items
    .slice()
    .sort((left, right) => left.updatedAt - right.updatedAt)
    .flatMap((item) => detailsForItem(item, toolRuns, includeToolArguments));

  if (explanation) {
    details.unshift({ label: 'Plan', value: explanation });
  }
  if (!details.length) {
    details.push({ label: 'Status', value: statusText(fallbackStatus) });
  }
  return details;
}

function detailsForPhase(
  phase: ContextLensActivityItem,
  items: ContextLensActivityItem[],
  toolRuns: readonly AgentTaskToolRun[],
  includeToolArguments: boolean,
  taskStatus: AgentTaskStatus
) {
  const details = items.flatMap((item) =>
    detailsForItem(item, toolRuns, includeToolArguments)
  );
  if (
    taskStatus === 'failed' &&
    !details.some(
      (detail) => detail.label === 'Error' || detail.label === 'Outcome'
    )
  ) {
    details.push({
      label: 'Outcome',
      value: 'The run ended before this task produced a reply.',
    });
  }
  if (!details.length) {
    details.push({ label: 'Status', value: statusText(phase.status) });
  }
  const elapsed = itemDuration(phase);
  if (elapsed && !details.some((detail) => detail.label === 'Elapsed')) {
    details.push({ label: 'Elapsed', value: elapsed });
  }
  return details;
}

function fallbackTitle(item: ContextLensActivityItem) {
  if (item.kind === 'commentary' && item.progressText) {
    return item.progressText;
  }
  if (item.name) {
    return labelFromIdentifier(item.name);
  }
  return item.title === 'Preamble' ? 'Progress update' : item.title;
}

function uniqueActionItems(items: readonly ContextLensActivityItem[]) {
  const byIdentity = new Map<string, ContextLensActivityItem>();
  for (const item of items) {
    if (
      item.kind === 'commentary' ||
      isGenericReasoning(item) ||
      isContextCompaction(item)
    ) {
      continue;
    }
    const identity = item.toolCallId ?? item.id;
    const existing = byIdentity.get(identity);
    if (!existing || item.updatedAt >= existing.updatedAt) {
      byIdentity.set(identity, item);
    }
  }
  return [...byIdentity.values()].sort(
    (left, right) => left.startedAt - right.startedAt
  );
}

function latestCommentaryText(items: readonly ContextLensActivityItem[]) {
  const commentary = [...items]
    .filter((item) => item.kind === 'commentary')
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
  if (!commentary) return null;
  const value = commentary.progressText ?? commentary.title;
  return value === 'Preamble' || value === 'Progress' ? null : value;
}

function actionGroupSummary(
  items: readonly ContextLensActivityItem[],
  waitingLabel: AgentTaskRow['waitingLabel'] = 'Waiting on you'
) {
  const groups = new Map<
    string,
    {
      count: number;
      completed: number;
      running: number;
      waiting: number;
      failed: number;
      pending: number;
    }
  >();
  for (const item of uniqueActionItems(items)) {
    const label = fallbackTitle(item);
    const group = groups.get(label) ?? {
      count: 0,
      completed: 0,
      running: 0,
      waiting: 0,
      failed: 0,
      pending: 0,
    };
    group.count += 1;
    const status = taskStatus(item.status);
    if (status === 'completed') group.completed += 1;
    else if (status === 'failed') group.failed += 1;
    else if (status === 'running') group.running += 1;
    else if (status === 'waiting') group.waiting += 1;
    else group.pending += 1;
    groups.set(label, group);
  }

  const summaries = [...groups.entries()].map(([label, group]) => {
    const actionLabel = `${label.charAt(0).toLowerCase()}${label.slice(1)}`;
    const prefix = `${group.count} ${actionLabel} ${group.count === 1 ? 'action' : 'actions'}`;
    const states = [
      group.completed ? `${group.completed} done` : null,
      group.running ? `${group.running} running` : null,
      group.waiting ? `${group.waiting} ${waitingLabel.toLowerCase()}` : null,
      group.failed ? `${group.failed} failed` : null,
      group.pending ? `${group.pending} not started` : null,
    ].filter(Boolean);
    if (states.length === 1) {
      if (group.completed === group.count) return `${prefix} completed`;
      if (group.running === group.count) return `${prefix} running`;
      if (group.waiting === group.count) {
        return `${prefix} ${waitingLabel.toLowerCase()}`;
      }
      if (group.failed === group.count) return `${prefix} failed`;
      if (group.pending === group.count) return `${prefix} not started`;
    }
    return `${prefix}: ${states.join(' · ')}`;
  });
  if (summaries.length <= 3) return summaries.join(' · ');
  return `${summaries.slice(0, 3).join(' · ')} · ${summaries.length - 3} more action types`;
}

function looksLikeOngoingProgress(value: string) {
  return /\b(?:i['’]?m|i am|we['’]?re|we are|checking|fetching|searching|resolving|validating|reviewing|building|writing|preparing|gathering|comparing|running|working|looking|finding|testing|verifying|publishing|uploading)\b/i.test(
    value
  );
}

function completedWorkSummary(items: readonly ContextLensActivityItem[]) {
  const commentary = latestCommentaryText(items);
  if (commentary && !looksLikeOngoingProgress(commentary)) {
    return commentary;
  }
  const count = uniqueActionItems(items).length;
  return count
    ? `${count} ${count === 1 ? 'action' : 'actions'} completed`
    : 'Completed';
}

function latestErrorText(
  items: readonly ContextLensActivityItem[],
  toolRuns: readonly AgentTaskToolRun[]
) {
  const errorItem = [...items]
    .filter(
      (item) =>
        item.kind === 'error' ||
        item.status === 'error' ||
        item.status === 'blocked' ||
        item.status === 'cancelled'
    )
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
  if (!errorItem) return null;
  return (
    toolRunForItem(errorItem, toolRuns)?.error ??
    errorItem.progressText ??
    (errorItem.kind === 'tool' ? null : itemValue(errorItem))
  );
}

function chatSubtitle(
  items: readonly ContextLensActivityItem[],
  status: AgentTaskStatus,
  toolRuns: readonly AgentTaskToolRun[],
  failureMessage?: string | null,
  waitingLabel: AgentTaskRow['waitingLabel'] = 'Waiting on you'
) {
  const error = latestErrorText(items, toolRuns);
  if (error) return error;
  if (status === 'completed') return completedWorkSummary(items);
  if (status === 'failed') {
    return failureMessage ?? 'Stopped before completion';
  }
  if (status === 'waiting') return waitingLabel;
  if (status === 'pending') return 'Not started';
  const commentary = latestCommentaryText(items);
  if (commentary) return commentary;
  const actions = actionGroupSummary(items, waitingLabel);
  if (actions) return actions;
  return 'Working';
}

function chatDetailsForItems(
  items: readonly ContextLensActivityItem[],
  status: AgentTaskStatus,
  toolRuns: readonly AgentTaskToolRun[],
  explanation?: string,
  ownsRunFailure = false,
  failureMessage?: string | null,
  waitingLabel: AgentTaskRow['waitingLabel'] = 'Waiting on you'
): AgentTaskDetail[] {
  const details: AgentTaskDetail[] = [];
  if (explanation) details.push({ label: 'Plan', value: explanation });

  const update = latestCommentaryText(items);
  if (update) {
    details.push({
      label:
        status === 'completed'
          ? looksLikeOngoingProgress(update)
            ? 'Last progress update'
            : 'Outcome'
          : status === 'failed'
            ? 'Last update'
            : 'Latest update',
      value: update,
    });
  }

  const actions = actionGroupSummary(items, waitingLabel);
  if (actions) details.push({ label: 'Actions', value: actions });

  const error = latestErrorText(items, toolRuns);
  if (error) details.push({ label: 'Error', value: error });

  if (ownsRunFailure && !error) {
    details.push(
      failureMessage
        ? { label: 'Error', value: failureMessage }
        : {
            label: 'Outcome',
            value: 'The run ended before this task produced a reply.',
          }
    );
  }
  if (!details.length) {
    details.push({
      label: 'Status',
      value:
        status === 'pending'
          ? 'Not started'
          : status === 'waiting'
            ? waitingLabel
            : status === 'completed'
              ? 'Completed'
              : status === 'failed'
                ? 'Failed'
                : 'Working',
    });
  }
  return details;
}

function activePlanStepId(activity: ContextLensActivity) {
  return (
    activity.plan?.steps.find(
      (step) => step.status === 'running' || step.status === 'waiting'
    )?.id ??
    activity.plan?.steps.find(
      (step) => step.status === 'pending' || step.status === 'unknown'
    )?.id
  );
}

/**
 * Turn a provider-neutral Context Lens snapshot into the Ochre task-row model.
 * Plan steps own stable rows; commentary and tools become their disclosure
 * details. Without a plan, commentary phases become stable user-sized tasks
 * and their tools/actions are nested beneath them. Generic reasoning remains
 * available in the Lens inspector but is not repeated as a chat task.
 */
export function buildAgentTaskRowsFromActivity(
  activity?: ContextLensActivity | null,
  liveEvents: readonly ContextLensActivityEvent[] = [],
  options: AgentTaskRowsOptions = {}
): AgentTaskRowsModel {
  if (!activity) return { rows: [] };

  const toolRuns = options.toolRuns ?? [];
  const includeToolArguments = options.includeToolArguments ?? false;
  const runOutcome = options.runOutcome ?? 'active';
  const presentation = options.presentation ?? 'inspector';
  const waitingLabel = options.waitingLabel ?? 'Waiting on you';

  const liveItems = [...activity.items];
  const liveStepId = activePlanStepId(activity);
  for (const event of liveEvents) {
    if (
      event.retention !== 'ephemeral' ||
      event.kind === 'lifecycle' ||
      event.kind === 'plan'
    ) {
      continue;
    }
    const id =
      event.itemId ??
      `${event.kind}:${event.toolCallId ?? event.name ?? event.sequence}`;
    const index = liveItems.findIndex((item) => item.id === id);
    const existing = index >= 0 ? liveItems[index] : undefined;
    const status = event.status ?? existing?.status ?? 'running';
    const item: ContextLensActivityItem = {
      id,
      kind: event.kind,
      title: event.title ?? existing?.title ?? event.name ?? 'Live activity',
      status,
      ...(existing?.planStepId ?? liveStepId
        ? { planStepId: existing?.planStepId ?? liveStepId }
        : {}),
      startedAt: existing?.startedAt ?? event.occurredAt,
      updatedAt: event.occurredAt,
      completedAt:
        status === 'completed' ||
        status === 'error' ||
        status === 'blocked' ||
        status === 'cancelled'
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
    if (index >= 0) liveItems[index] = item;
    else liveItems.push(item);
  }

  const terminalAt = activity.lastEventAt ?? undefined;
  const reconciledItems = liveItems.map((item) =>
    reconcileToolRun(item, toolRuns)
  );
  const effectiveItems = reconciledItems.map((reconciled) => {
    const status = terminalActivityStatus(reconciled.status, runOutcome);
    return status === reconciled.status
      ? reconciled
      : {
          ...reconciled,
          status,
          updatedAt: terminalAt ?? reconciled.updatedAt,
          completedAt:
            reconciled.completedAt ?? terminalAt ?? reconciled.updatedAt,
        };
  });
  const effectiveActivity = { ...activity, items: effectiveItems };

  const plan = effectiveActivity.plan;
  let rows: AgentTaskRow[];
  if (plan?.steps.length) {
    const fallbackStepId = activePlanStepId(effectiveActivity);
    const itemsByStep = new Map<string, ContextLensActivityItem[]>();
    for (const item of effectiveActivity.items) {
      if (isGenericReasoning(item)) continue;
      const stepId = item.planStepId ?? fallbackStepId;
      if (!stepId) continue;
      const items = itemsByStep.get(stepId) ?? [];
      items.push(item);
      itemsByStep.set(stepId, items);
    }

    const firstIncompleteStepIndex = plan.steps.findIndex(
      (step) => taskStatus(step.status) !== 'completed'
    );
    const explicitFailedStepId = reconciledItems
      .filter((item) => item.planStepId && taskStatus(item.status) === 'failed')
      .sort((left, right) => right.updatedAt - left.updatedAt)[0]?.planStepId;
    const explicitFailedStepIndex = explicitFailedStepId
      ? plan.steps.findIndex((step) => step.id === explicitFailedStepId)
      : -1;
    const failedStepIndex =
      runOutcome === 'failed'
        ? explicitFailedStepIndex >= 0
          ? explicitFailedStepIndex
          : firstIncompleteStepIndex >= 0
            ? firstIncompleteStepIndex
            : plan.steps.length - 1
        : -1;
    const explicitWaitingStepIndex = plan.steps.findIndex(
      (step) => step.status === 'waiting'
    );
    const waitingItemStepId = reconciledItems.find(
      isStructuredWaitingActivityItem
    )?.planStepId;
    const waitingItemStepIndex = waitingItemStepId
      ? plan.steps.findIndex((step) => step.id === waitingItemStepId)
      : -1;
    const waitingStepIndex =
      runOutcome === 'waiting'
        ? explicitWaitingStepIndex >= 0
          ? explicitWaitingStepIndex
          : waitingItemStepIndex >= 0
            ? waitingItemStepIndex
            : firstIncompleteStepIndex
        : -1;
    rows = plan.steps.map((step, index) => {
      const items = itemsByStep.get(step.id) ?? [];
      const ownsRunFailure = index === failedStepIndex;
      const status =
        runOutcome === 'failed'
          ? ownsRunFailure
            ? 'error'
            : step.status
          : index === waitingStepIndex
            ? 'waiting'
            : terminalActivityStatus(step.status, runOutcome);
      const rowStatus = taskStatus(status);
      const details =
        presentation === 'chat'
          ? chatDetailsForItems(
              items,
              rowStatus,
              toolRuns,
              index === 0 ? plan.explanation : undefined,
              ownsRunFailure,
              options.failureMessage,
              waitingLabel
            )
          : detailsForItems(
              items,
              status,
              toolRuns,
              includeToolArguments,
              index === 0 ? plan.explanation : undefined
            );
      if (
        presentation === 'inspector' &&
        ownsRunFailure &&
        !details.some(
          (detail) => detail.label === 'Error' || detail.label === 'Outcome'
        )
      ) {
        details.push({
          label: 'Outcome',
          value: 'The run ended before this task produced a reply.',
        });
      }
      const actionCount = uniqueActionItems(items).length;
      const detailCount = presentation === 'chat' ? actionCount : items.length;
      return {
        id: step.id,
        sequence: index + 1,
        title: step.title,
        ...(presentation === 'chat'
          ? {
              subtitle:
                (runOutcome === 'incomplete' || runOutcome === 'unavailable') &&
                rowStatus === 'pending'
                  ? runOutcome === 'unavailable'
                    ? 'Status unavailable'
                    : step.status === 'pending'
                      ? 'Not started'
                      : 'Not finished'
                  : chatSubtitle(
                      items,
                      rowStatus,
                      toolRuns,
                      ownsRunFailure ? options.failureMessage : undefined,
                      waitingLabel
                    ),
            }
          : {}),
        status: rowStatus,
        ...(rowStatus === 'waiting' ? { waitingLabel } : {}),
        ...(detailCount
          ? {
              meta: `${detailCount} ${detailCount === 1 ? 'action' : 'actions'}`,
            }
          : {}),
        details,
      };
    });
  } else if (presentation === 'chat') {
    const items = effectiveActivity.items
      .filter((item) => !isGenericReasoning(item) && !isContextCompaction(item))
      .sort(
        (left, right) =>
          left.startedAt - right.startedAt || left.updatedAt - right.updatedAt
      );
    const failedItem = items.some(
      (item) => taskStatus(item.status) === 'failed'
    );
    const runningItem = items.some(
      (item) => taskStatus(item.status) === 'running'
    );
    const status: AgentTaskStatus =
      runOutcome === 'failed' || failedItem
        ? 'failed'
        : runOutcome === 'waiting'
          ? 'waiting'
          : runOutcome === 'unavailable'
            ? 'pending'
            : runOutcome === 'completed'
              ? 'completed'
              : runningItem || items.length
                ? 'running'
                : 'pending';
    const title =
      latestCommentaryText(items) ??
      (status === 'pending'
        ? 'Preparing this request'
        : 'Working on this request');
    const actionCount = uniqueActionItems(items).length;
    rows = [
      {
        id: 'unplanned-work',
        sequence: 1,
        title,
        subtitle:
          runOutcome === 'unavailable'
            ? 'Status unavailable'
            : actionGroupSummary(items, waitingLabel) ||
              (status === 'running'
                ? 'Waiting for a task plan'
                : chatSubtitle(
                    items,
                    status,
                    toolRuns,
                    options.failureMessage,
                    waitingLabel
                  )),
        status,
        ...(status === 'waiting' ? { waitingLabel } : {}),
        ...(actionCount
          ? {
              meta: `${actionCount} ${actionCount === 1 ? 'action' : 'actions'}`,
            }
          : {}),
        details: chatDetailsForItems(
          items,
          status,
          toolRuns,
          undefined,
          runOutcome === 'failed',
          options.failureMessage,
          waitingLabel
        ),
      },
    ];
  } else {
    const orderedItems = effectiveActivity.items
      .filter((item) => !isGenericReasoning(item))
      .sort(
        (left, right) =>
          left.startedAt - right.startedAt || left.updatedAt - right.updatedAt
      );
    const standalone: ContextLensActivityItem[] = [];
    const phases: Array<{
      phase: ContextLensActivityItem;
      items: ContextLensActivityItem[];
    }> = [];

    for (const item of orderedItems) {
      if (item.kind === 'commentary') {
        phases.push({ phase: item, items: [] });
      } else if (phases.length) {
        phases.at(-1)!.items.push(item);
      } else {
        standalone.push(item);
      }
    }

    const standaloneRows: AgentTaskRow[] = standalone.map((item) => ({
      id: item.id,
      sequence: 0,
      title: fallbackTitle(item),
      status: taskStatus(item.status),
      meta: itemLabel(item),
      details: detailsForItem(item, toolRuns, includeToolArguments),
    }));
    const phaseRows: AgentTaskRow[] = phases.map(
      ({ phase, items }, phaseIndex) => {
        const failedChild = items.some(
          (item) => taskStatus(item.status) === 'failed'
        );
        const runningChild = items.some(
          (item) => taskStatus(item.status) === 'running'
        );
        const ownsRunFailure =
          runOutcome === 'failed' && phaseIndex === phases.length - 1;
        const status =
          ownsRunFailure || failedChild
            ? 'failed'
            : runningChild
              ? 'running'
              : taskStatus(phase.status);
        return {
          id: phase.id,
          sequence: 0,
          title: fallbackTitle(phase),
          status,
          ...(items.length
            ? {
                meta: `${items.length} ${items.length === 1 ? 'action' : 'actions'}`,
              }
            : {}),
          details: detailsForPhase(
            phase,
            items,
            toolRuns,
            includeToolArguments,
            status
          ),
        };
      }
    );
    if (runOutcome === 'failed' && phaseRows.length === 0) {
      const lastStandalone = standaloneRows.at(-1);
      if (lastStandalone) {
        lastStandalone.status = 'failed';
        lastStandalone.details = [
          ...(lastStandalone.details ?? []),
          {
            label: 'Outcome',
            value: 'The run ended before this task produced a reply.',
          },
        ];
      }
    }
    rows = [...standaloneRows, ...phaseRows].map((row, index) => ({
      ...row,
      sequence: index + 1,
    }));
  }

  const autoExpandedId = [...rows]
    .reverse()
    .find((row) =>
      runOutcome === 'failed'
        ? row.status === 'failed'
        : row.status === 'running' || row.status === 'waiting'
    )?.id;
  return { rows, ...(autoExpandedId ? { autoExpandedId } : {}) };
}
