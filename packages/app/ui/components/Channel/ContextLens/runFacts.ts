import {
  type LensTone,
  formatDuration,
  formatToolName,
  formatWallTime,
  persistenceLabel,
  runKindLabel,
  sourceKindLabel,
} from './format';
import type { ContextLens, ContextLensToolRun } from './types';

export type LensMessageTarget = {
  postId: string;
  channelId?: string;
  authorId?: string;
  parentId?: string;
};

/** A labelled value about a run, and the message it opens, if any. */
export type RunFact = {
  label: string;
  value: string;
  target?: LensMessageTarget;
};

/** One recorded thing a run took in or did, such as a context source. */
export type RunItem = {
  key: string;
  title: string;
  meta: string;
  detail: string;
  tone: LensTone;
};

/** How a run started. */
export function triggerFacts(lens: ContextLens): RunFact[] {
  const messageId = lens.triggerDetails?.messageId ?? lens.messageId;
  const channelId = lens.triggerDetails?.conversationId;
  // Cron and internal runs start from no message: their trigger id is made
  // up for the lens, so there is nothing to open.
  const isMessage = lens.runKind !== 'cron' && lens.chatType !== 'internal';
  return [
    { label: 'Run', value: runKindLabel(lens) },
    ...(lens.retryOf
      ? [{ label: 'Retry of', value: lens.retryOf.slice(0, 8) }]
      : []),
    { label: 'Visibility', value: lens.visibility ?? 'owner' },
    {
      label: 'Message',
      value: messageId,
      ...(isMessage && messageId && channelId
        ? {
            target: {
              postId: messageId,
              channelId,
              authorId: lens.triggerDetails?.authorShip,
            },
          }
        : {}),
    },
    { label: 'Author', value: lens.triggerDetails?.authorShip ?? 'unknown' },
    {
      label: 'Conversation',
      value: lens.triggerDetails?.conversationId ?? lens.chatType,
    },
    {
      label: 'Received',
      value: formatWallTime(lens.triggerDetails?.receivedAt),
    },
  ];
}

/** The first context sources the run recorded. */
export function contextSourceItems(lens: ContextLens): RunItem[] {
  return (lens.context.sources ?? []).slice(0, 8).map((source, index) => ({
    key: `${source.kind}-${source.sourceId ?? source.label}-${index}`,
    title: source.label,
    meta: `${source.included ? 'included' : 'excluded'} · ${sourceKindLabel(source.kind)}`,
    detail: source.reason ?? source.preview ?? 'recorded by run',
    tone: source.included ? 'neutral' : 'warning',
  }));
}

/** The first writes the run made, or tried to. */
export function persistenceItems(lens: ContextLens): RunItem[] {
  return (lens.persistence.events ?? []).slice(0, 8).map((event, index) => ({
    key: `${event.kind}-${event.action}-${event.at}-${index}`,
    title: persistenceLabel(event),
    meta: event.status,
    detail: event.reason ?? event.key ?? formatWallTime(event.at),
    tone:
      event.status === 'failed'
        ? 'negative'
        : event.status === 'skipped'
          ? 'warning'
          : 'positive',
  }));
}

/** One tool call, as the run recorded it. */
export function toolRunFact(run: ContextLensToolRun): {
  title: string;
  status: string;
  detail: string;
  tone: LensTone;
} {
  return {
    title: `${run.callIndex}. ${formatToolName(run.name)}`,
    status: run.status,
    detail: run.error
      ? run.error
      : run.argumentSummary
        ? `${run.argumentSummary}${run.durationMs ? ` · ${formatDuration(run.durationMs)}` : ''}`
        : run.durationMs
          ? `${formatDuration(run.durationMs)}${run.phase ? ` · ${run.phase}` : ''}`
          : (run.phase ?? 'running'),
    tone:
      run.status === 'error'
        ? 'negative'
        : run.status === 'blocked'
          ? 'warning'
          : 'positive',
  };
}
