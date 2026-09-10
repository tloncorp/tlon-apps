import {
  type ContextLens,
  type ContextLensEvent,
  type ContextLensPersistenceEvent,
  type ContextLensSource,
  type ContextLensStatus,
  FINAL_STATUSES,
} from './types';

export type LensTone = 'positive' | 'negative' | 'warning' | 'neutral';

export const TONE_COLORS: Record<LensTone, string> = {
  positive: '$positiveActionText',
  negative: '$negativeActionText',
  warning: '$tertiaryText',
  neutral: '$secondaryText',
};

export function statusTone(status: ContextLensStatus): LensTone {
  if (status === 'completed') {
    return 'positive';
  }
  if (status === 'error' || status === 'timed_out') {
    return 'negative';
  }
  if (status === 'no_reply' || status === 'aborted') {
    return 'warning';
  }
  return 'neutral';
}

export function statusLabel(status: ContextLensStatus) {
  switch (status) {
    case 'no_reply':
      return 'No reply';
    case 'timed_out':
      return 'Timed out';
    case 'tool_running':
      return 'Tool running';
    default:
      return status
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
}

export function formatDuration(ms: number | null | undefined) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    return 'pending';
  }
  if (ms < 1000) {
    return `${Math.max(0, Math.round(ms))}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

export function formatWallTime(ms?: number | null) {
  if (!ms) {
    return 'unknown';
  }
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatWallDateTime(ms?: number | null) {
  if (!ms) {
    return 'unknown';
  }
  return new Date(ms).toLocaleString([], {
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatToolName(toolName: string) {
  return toolName.replaceAll('_', ' ');
}

export function summarizeContext(lens: ContextLens) {
  const parts = ['current'];
  if (lens.context.threadMessages) {
    parts.push(`${lens.context.threadMessages} thread`);
  }
  if (lens.context.channelMessages) {
    parts.push(`${lens.context.channelMessages} channel`);
  }
  if (lens.context.citedPosts) {
    parts.push(`${lens.context.citedPosts} cites`);
  }
  if (lens.context.attachments) {
    parts.push(`${lens.context.attachments} files`);
  }
  if (lens.context.pendingNudge) {
    parts.push('nudge');
  }
  return parts.join(' / ');
}

export function summarizeWrites(lens: ContextLens) {
  const parts = [
    lens.persistence.postsReply ? 'reply' : null,
    lens.persistence.updatesSettings ? 'settings' : null,
    lens.persistence.writesMedia ? 'media' : null,
    lens.persistence.emitsTelemetry ? 'telemetry' : null,
    lens.persistence.cachesHistory ? 'history' : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'none';
}

export function summarizeToolEvents(
  events: ContextLensEvent[],
  lens: ContextLens
) {
  if (!lens.tools.callCount) {
    return null;
  }

  const counts = new Map<string, number>();
  const toolEvents = events.filter((event) => event.phase === 'tool_start');
  for (const event of toolEvents) {
    const name = event.detail?.toolName?.trim();
    if (!name) {
      continue;
    }
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  if (!counts.size) {
    for (const name of lens.tools.called) {
      counts.set(name, 0);
    }
  }

  const names = [...counts.entries()].map(([name, count]) =>
    count ? `${formatToolName(name)} x${count}` : formatToolName(name)
  );

  return {
    summary: names.length
      ? names.join(' / ')
      : pluralize(lens.tools.callCount, 'tool call'),
    total: lens.tools.callCount,
    latest:
      [...toolEvents].reverse().find((event) => event.detail?.toolName)?.detail
        ?.toolName ?? lens.tools.called.at(-1),
  };
}

export function sourceKindLabel(kind: ContextLensSource['kind']) {
  return kind.replaceAll('_', ' ');
}

export function persistenceLabel(event: ContextLensPersistenceEvent) {
  return `${event.action} ${event.kind.replaceAll('_', ' ')} · ${event.location}`;
}

export function runKindLabel(lens: ContextLens) {
  const kind =
    lens.runKind ??
    (lens.chatType === 'internal' ? 'internal' : 'conversation');
  return kind.replaceAll('_', ' ');
}

export function runPreview(lens: ContextLens) {
  return (
    lens.triggerDetails?.preview?.trim() ||
    lens.outputs?.find((output) => output.preview)?.preview?.trim() ||
    lens.triggerDetails?.messageId ||
    lens.messageId
  );
}

export function runMeta(lens: ContextLens) {
  return [
    runKindLabel(lens),
    pluralize(lens.lifecycle.deliveredMessageCount, 'message'),
    formatDuration(lens.lifecycle.durationMs),
  ].join(' / ');
}

export function isFinalStatus(status: ContextLensStatus) {
  return FINAL_STATUSES.has(status);
}

const RETRYABLE_STATUSES = new Set<ContextLensStatus>([
  'no_reply',
  'timed_out',
  'aborted',
  'error',
]);

/**
 * Whether the owner can ask the bot to re-run this run. Completed runs are
 * excluded (a retry would post a duplicate reply), as are internal runs.
 */
export function canRetryLens(lens: ContextLens) {
  return (
    RETRYABLE_STATUSES.has(lens.status) &&
    lens.chatType !== 'internal' &&
    lens.runKind !== 'internal'
  );
}
