import { Icon } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { ScrollView, SizableText, View, XStack, YStack } from 'tamagui';

type ContextLensStatus =
  | 'assembling'
  | 'queued'
  | 'dispatching'
  | 'tool_running'
  | 'delivering'
  | 'completed'
  | 'no_reply'
  | 'timed_out'
  | 'error';

type ContextLens = {
  lensId: string;
  messageId: string;
  sessionKeyHash?: string | null;
  chatType: 'dm' | 'channel';
  trigger: string;
  triggerDetails?: {
    type: string;
    messageId: string;
    authorShip?: string;
    conversationId?: string;
    conversationKind: 'dm' | 'channel';
    receivedAt?: number;
    preview?: string;
  };
  model: string | null;
  provider: string | null;
  status: ContextLensStatus;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  context: {
    currentMessage: boolean;
    threadMessages: number;
    channelMessages: number;
    citedPosts: number;
    attachments: number;
    pendingNudge: boolean;
    sources?: ContextLensSource[];
  };
  persistence: {
    postsReply: boolean;
    updatesSettings: boolean;
    writesMedia: boolean;
    emitsTelemetry: boolean;
    cachesHistory: boolean;
    events?: ContextLensPersistenceEvent[];
  };
  tools: {
    ownerOnlyAvailable: string[];
    called: string[];
    callCount: number;
    lastStartedAt: number | null;
    runs?: ContextLensToolRun[];
  };
  outputs?: ContextLensOutput[];
  lifecycle: {
    queuedMs: number;
    durationMs: number | null;
    timeoutMs: number | null;
    timedOut: boolean;
    deliveredMessageCount: number;
    queuedFinal: boolean;
    queuedFinalCount: number;
    queuedBlockCount: number;
  };
};

type ContextLensSource = {
  kind: 'message' | 'memory' | 'identity' | 'system' | 'tool_result' | 'other';
  label: string;
  sourceId?: string;
  included: boolean;
  reason?: string;
  tokenEstimate?: number;
  preview?: string;
};

type ContextLensToolRun = {
  id: string;
  callIndex: number;
  name: string;
  phase?: string;
  startedAt: number;
  completedAt: number | null;
  durationMs: number | null;
  status: 'running' | 'completed' | 'error';
  argumentSummary?: string;
  resultSummary?: string;
  error?: string;
};

type ContextLensOutput = {
  messageId: string;
  conversationId: string;
  kind: 'dm' | 'channel';
  sentAt: number;
  preview?: string;
  chunkIndex?: number;
};

type ContextLensPersistenceEvent = {
  kind: 'memory' | 'conversation_state' | 'tool_cache' | 'artifact' | 'other';
  action: 'read' | 'created' | 'updated' | 'skipped' | 'deleted';
  location: 'openclaw' | 'urbit' | 'tlon-desk' | 'external';
  status: 'ok' | 'failed' | 'skipped';
  key?: string;
  reason?: string;
  at: number;
};

export type ContextLensEvent = {
  seq: number;
  at: number;
  phase: string;
  lens: ContextLens;
  detail?: {
    toolName?: string;
    toolPhase?: string;
    toolCallCount?: number;
  };
};

export type ContextLensSelectedMessage = {
  id: string;
  authorId?: string | null;
  channelId?: string | null;
  lensId?: string | null;
};

type LensStreamState = {
  events: ContextLensEvent[];
  status: 'disabled' | 'connecting' | 'connected' | 'offline';
};

const MAX_EVENTS = 160;
const FINAL_STATUSES = new Set<ContextLensStatus>([
  'completed',
  'no_reply',
  'timed_out',
  'error',
]);
const TIMELINE_BORDER = 'rgba(101, 216, 255, 0.3)';
const TIMELINE_ACTIVE_BORDER = 'rgba(150, 240, 255, 0.62)';
const TIMELINE_BACKGROUND = 'rgba(101, 216, 255, 0.035)';
const TIMELINE_ACTIVE_BACKGROUND = 'rgba(101, 216, 255, 0.09)';

function getGatewayBaseUrl() {
  if (Platform.OS !== 'web') {
    return null;
  }

  const stored =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('tlon.contextLens.gatewayUrl')?.trim()
      : null;
  if (stored) {
    return stored;
  }

  return process.env.NODE_ENV === 'development'
    ? 'http://localhost:18789'
    : null;
}

function encodeQuery(value: string) {
  return encodeURIComponent(value.trim());
}

function findEventForLensId(events: ContextLensEvent[], lensId: string) {
  return [...events].reverse().find((event) => event.lens.lensId === lensId);
}

function findEventForMessage(
  events: ContextLensEvent[],
  selected: ContextLensSelectedMessage
) {
  if (selected.lensId) {
    return findEventForLensId(events, selected.lensId);
  }
  return undefined;
}

function mergeEvent(events: ContextLensEvent[], event: ContextLensEvent) {
  if (events.some((existing) => existing.seq === event.seq)) {
    return events;
  }
  return [...events, event]
    .sort((left, right) => left.seq - right.seq)
    .slice(-MAX_EVENTS);
}

export function useContextLensEvents(): LensStreamState {
  const [events, setEvents] = useState<ContextLensEvent[]>([]);
  const [status, setStatus] = useState<LensStreamState['status']>(
    Platform.OS === 'web' ? 'connecting' : 'disabled'
  );

  useEffect(() => {
    const gatewayBaseUrl = getGatewayBaseUrl();
    if (!gatewayBaseUrl || typeof EventSource === 'undefined') {
      setStatus('disabled');
      return;
    }

    let cancelled = false;
    const recentUrl = `${gatewayBaseUrl}/tlon/context-lens/recent`;
    const eventsUrl = `${gatewayBaseUrl}/tlon/context-lens/events`;

    setStatus('connecting');
    fetch(recentUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { events?: ContextLensEvent[] } | null) => {
        if (cancelled || !Array.isArray(payload?.events)) {
          return;
        }
        setEvents(payload.events.slice(-MAX_EVENTS));
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('offline');
        }
      });

    const source = new EventSource(eventsUrl);
    source.onopen = () => {
      if (!cancelled) {
        setStatus('connected');
      }
    };
    source.onerror = () => {
      if (!cancelled) {
        setStatus('offline');
      }
    };
    source.addEventListener('context-lens', (message) => {
      try {
        const event = JSON.parse(message.data) as ContextLensEvent;
        setEvents((current) => mergeEvent(current, event));
      } catch {
        // Ignore malformed diagnostics from experimental local gateways.
      }
    });

    return () => {
      cancelled = true;
      source.close();
    };
  }, []);

  return { events, status };
}

export function useContextLensRuns(events: ContextLensEvent[]) {
  return useMemo(() => {
    const latestByLens = new Map<string, ContextLensEvent>();
    for (const event of events) {
      latestByLens.set(event.lens.lensId, event);
    }
    return [...latestByLens.values()].sort((left, right) => right.at - left.at);
  }, [events]);
}

export function isContextLensEventActive(event: ContextLensEvent) {
  return !FINAL_STATUSES.has(event.lens.status);
}

function statusLabel(status: ContextLensStatus) {
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

function formatDuration(ms: number | null | undefined) {
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

function summarizeContext(lens: ContextLens) {
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

function summarizeWrites(lens: ContextLens) {
  const parts = [
    lens.persistence.postsReply ? 'reply' : null,
    lens.persistence.updatesSettings ? 'settings' : null,
    lens.persistence.writesMedia ? 'media' : null,
    lens.persistence.emitsTelemetry ? 'telemetry' : null,
    lens.persistence.cachesHistory ? 'history' : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'none';
}

function statusTone(status: ContextLensStatus) {
  if (status === 'completed') {
    return '#47f6a4';
  }
  if (status === 'error' || status === 'timed_out') {
    return '#ff5b8f';
  }
  if (status === 'no_reply') {
    return '#ffd166';
  }
  return '#65d8ff';
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatToolName(toolName: string) {
  return toolName.replaceAll('_', ' ');
}

function summarizeToolEvents(events: ContextLensEvent[], lens: ContextLens) {
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

type TimelineRow = {
  key: string;
  title: string;
  detail: string;
  meta: string;
  tone: string;
  active?: boolean;
};

function buildRunTimeline(
  events: ContextLensEvent[],
  latest: ContextLensEvent
) {
  const lens = latest.lens;
  const rows: TimelineRow[] = [
    {
      key: 'context',
      title: 'Assembled context',
      detail: summarizeContext(lens),
      meta: events.find((event) => event.phase === 'created')
        ? 'created'
        : 'ready',
      tone: '#65d8ff',
    },
  ];

  if (lens.lifecycle.queuedMs || lens.lifecycle.queuedBlockCount) {
    rows.push({
      key: 'queue',
      title: lens.lifecycle.queuedBlockCount ? 'Waited for session' : 'Queued',
      detail: [
        lens.lifecycle.queuedMs
          ? `${formatDuration(lens.lifecycle.queuedMs)} wait`
          : null,
        lens.lifecycle.queuedBlockCount
          ? pluralize(lens.lifecycle.queuedBlockCount, 'blocked run')
          : null,
      ]
        .filter(Boolean)
        .join(' / '),
      meta: 'queue',
      tone: '#ffd166',
    });
  }

  const modelEvent = events.find((event) => event.phase === 'model_selected');
  rows.push({
    key: 'model',
    title: modelEvent ? 'Selected model' : 'Model pending',
    detail:
      lens.provider || lens.model
        ? [lens.provider, lens.model].filter(Boolean).join(' / ')
        : 'waiting for provider',
    meta: modelEvent ? `#${modelEvent.seq}` : 'pending',
    tone: modelEvent ? '#65d8ff' : '#ffd166',
    active: !modelEvent && !FINAL_STATUSES.has(lens.status),
  });

  const tools = summarizeToolEvents(events, lens);
  if (tools) {
    rows.push({
      key: 'tools',
      title:
        lens.status === 'tool_running' && tools.latest
          ? `Using ${formatToolName(tools.latest)}`
          : 'Used tools',
      detail: `${tools.summary} · ${pluralize(tools.total, 'call')}`,
      meta: 'tools',
      tone: lens.status === 'tool_running' ? '#65d8ff' : '#47f6a4',
      active: lens.status === 'tool_running',
    });
  }

  if (FINAL_STATUSES.has(lens.status) || lens.status === 'delivering') {
    rows.push({
      key: 'delivery',
      title:
        lens.status === 'completed'
          ? 'Delivered reply'
          : lens.status === 'no_reply'
            ? 'No reply emitted'
            : lens.status === 'timed_out'
              ? 'Timed out'
              : lens.status === 'error'
                ? 'Run failed'
                : 'Delivering reply',
      detail:
        lens.status === 'error' && lens.error
          ? lens.error
          : [
              pluralize(lens.lifecycle.deliveredMessageCount, 'message'),
              formatDuration(lens.lifecycle.durationMs),
            ].join(' / '),
      meta: latest.phase,
      tone: statusTone(lens.status),
      active: lens.status === 'delivering',
    });
  } else {
    rows.push({
      key: 'live',
      title: statusLabel(lens.status),
      detail: `running for ${formatDuration(Date.now() - lens.createdAt)}`,
      meta: latest.phase,
      tone: statusTone(lens.status),
      active: true,
    });
  }

  return rows;
}

function formatWallTime(ms?: number | null) {
  if (!ms) {
    return 'unknown';
  }
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function sourceKindLabel(kind: ContextLensSource['kind']) {
  return kind.replaceAll('_', ' ');
}

function persistenceLabel(event: ContextLensPersistenceEvent) {
  return `${event.action} ${event.kind.replaceAll('_', ' ')} · ${event.location}`;
}

function runPreview(lens: ContextLens) {
  return (
    lens.triggerDetails?.preview?.trim() ||
    lens.outputs?.find((output) => output.preview)?.preview?.trim() ||
    lens.triggerDetails?.messageId ||
    lens.messageId
  );
}

function runMeta(lens: ContextLens) {
  return [
    lens.chatType.toUpperCase(),
    pluralize(lens.lifecycle.deliveredMessageCount, 'message'),
    formatDuration(lens.lifecycle.durationMs),
  ].join(' / ');
}

function EmptySelectedRun({
  lookupStatus,
}: {
  lookupStatus: 'idle' | 'loading' | 'missing' | 'error';
}) {
  const copy =
    lookupStatus === 'loading'
      ? 'Looking for Lens metadata'
      : lookupStatus === 'error'
        ? 'Lens lookup failed'
        : 'No Lens metadata for this message';
  return (
    <YStack
      alignItems="center"
      justifyContent="center"
      minHeight={180}
      gap="$m"
      borderWidth={1}
      borderColor="rgba(255, 209, 102, 0.22)"
      borderRadius="$m"
      backgroundColor="rgba(255, 209, 102, 0.045)"
      padding="$m"
    >
      <Icon type="Info" color="$positiveActionText" />
      <SizableText
        size="$m"
        color="rgba(240, 250, 255, 0.7)"
        textAlign="center"
      >
        {copy}
      </SizableText>
      <SizableText
        size="$s"
        color="rgba(240, 250, 255, 0.48)"
        textAlign="center"
      >
        Recent live runs can be inspected immediately. Older messages need
        retained Lens metadata from the gateway.
      </SizableText>
    </YStack>
  );
}

function RunInspector({ lens }: { lens: ContextLens }) {
  const sources = lens.context.sources ?? [];
  const includedSources = sources.filter((source) => source.included);
  const excludedSources = sources.filter((source) => !source.included);
  const toolRuns = lens.tools.runs ?? [];
  const outputs = lens.outputs ?? [];
  const persistenceEvents = lens.persistence.events ?? [];

  return (
    <YStack gap="$s">
      <InspectorSection title="Trigger">
        <DetailRow
          label="Message"
          value={lens.triggerDetails?.messageId ?? lens.messageId}
        />
        <DetailRow
          label="Author"
          value={lens.triggerDetails?.authorShip ?? 'unknown'}
        />
        <DetailRow
          label="Conversation"
          value={lens.triggerDetails?.conversationId ?? lens.chatType}
        />
        <DetailRow
          label="Received"
          value={formatWallTime(lens.triggerDetails?.receivedAt)}
        />
        {lens.triggerDetails?.preview ? (
          <PreviewText value={lens.triggerDetails.preview} />
        ) : null}
      </InspectorSection>

      <InspectorSection title="Context">
        <Metric
          label="Included"
          value={pluralize(includedSources.length, 'source')}
        />
        <Metric
          label="Excluded"
          value={pluralize(excludedSources.length, 'source')}
        />
        {sources.length ? (
          <YStack gap="$xs" marginTop="$xs">
            {sources.slice(0, 8).map((source, index) => (
              <LensListItem
                key={`${source.kind}-${source.sourceId ?? source.label}-${index}`}
                title={source.label}
                meta={`${source.included ? 'included' : 'excluded'} · ${sourceKindLabel(source.kind)}`}
                detail={source.reason ?? source.preview ?? 'recorded by run'}
                tone={source.included ? '#65d8ff' : '#ffd166'}
              />
            ))}
          </YStack>
        ) : (
          <MutedLine value={summarizeContext(lens)} />
        )}
      </InspectorSection>

      <InspectorSection title="Tools">
        {toolRuns.length ? (
          <YStack gap="$xs">
            {toolRuns.map((run) => (
              <LensListItem
                key={run.id}
                title={`${run.callIndex}. ${formatToolName(run.name)}`}
                meta={run.status}
                detail={
                  run.durationMs
                    ? `${formatDuration(run.durationMs)}${run.phase ? ` · ${run.phase}` : ''}`
                    : run.phase ?? 'running'
                }
                tone={run.status === 'error' ? '#ff5b8f' : '#47f6a4'}
              />
            ))}
          </YStack>
        ) : (
          <MutedLine value="No tools called" />
        )}
      </InspectorSection>

      <InspectorSection title="Output">
        {outputs.length ? (
          <YStack gap="$xs">
            {outputs.map((output, index) => (
              <LensListItem
                key={`${output.messageId}-${index}`}
                title={output.messageId}
                meta={`${output.kind} · ${formatWallTime(output.sentAt)}`}
                detail={output.preview ?? output.conversationId}
                tone="#65d8ff"
              />
            ))}
          </YStack>
        ) : (
          <MutedLine value="No bot reply recorded yet" />
        )}
      </InspectorSection>

      <InspectorSection title="Persistence">
        {persistenceEvents.length ? (
          <YStack gap="$xs">
            {persistenceEvents.slice(0, 8).map((event, index) => (
              <LensListItem
                key={`${event.kind}-${event.action}-${event.at}-${index}`}
                title={persistenceLabel(event)}
                meta={event.status}
                detail={event.reason ?? event.key ?? formatWallTime(event.at)}
                tone={
                  event.status === 'failed'
                    ? '#ff5b8f'
                    : event.status === 'skipped'
                      ? '#ffd166'
                      : '#47f6a4'
                }
              />
            ))}
          </YStack>
        ) : (
          <MutedLine value={summarizeWrites(lens)} />
        )}
      </InspectorSection>
    </YStack>
  );
}

function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <YStack
      gap="$s"
      borderWidth={1}
      borderColor="rgba(101, 216, 255, 0.18)"
      borderRadius="$m"
      padding="$m"
      backgroundColor="rgba(255, 255, 255, 0.035)"
    >
      <SizableText
        size="$s"
        color="rgba(101, 216, 255, 0.72)"
        textTransform="uppercase"
        letterSpacing={0}
      >
        {title}
      </SizableText>
      {children}
    </YStack>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <Metric label={label} value={value || 'unknown'} />;
}

function PreviewText({ value }: { value: string }) {
  return (
    <SizableText
      size="$s"
      color="rgba(248, 252, 255, 0.78)"
      backgroundColor="rgba(101, 216, 255, 0.055)"
      borderRadius="$s"
      padding="$s"
    >
      {value}
    </SizableText>
  );
}

function MutedLine({ value }: { value: string }) {
  return (
    <SizableText size="$s" color="rgba(240, 250, 255, 0.5)">
      {value}
    </SizableText>
  );
}

function LensListItem({
  title,
  meta,
  detail,
  tone,
}: {
  title: string;
  meta: string;
  detail: string;
  tone: string;
}) {
  return (
    <YStack
      gap="$2xs"
      minWidth={0}
      borderLeftWidth={2}
      borderColor={tone}
      paddingLeft="$s"
      paddingVertical="$2xs"
    >
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap="$s"
        minWidth={0}
      >
        <SizableText
          size="$s"
          color="rgba(248, 252, 255, 0.88)"
          flex={1}
          minWidth={0}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {title}
        </SizableText>
        <SizableText size="$s" color="rgba(240, 250, 255, 0.42)" flexShrink={0}>
          {meta}
        </SizableText>
      </XStack>
      <SizableText size="$s" color="rgba(240, 250, 255, 0.54)">
        {detail}
      </SizableText>
    </YStack>
  );
}

function RecentRunList({
  runs,
  activeLensId,
  followLatest,
  onSelectRun,
  onFollowLatest,
}: {
  runs: ContextLensEvent[];
  activeLensId?: string | null;
  followLatest: boolean;
  onSelectRun: (event: ContextLensEvent) => void;
  onFollowLatest: () => void;
}) {
  if (!runs.length) {
    return null;
  }

  return (
    <YStack
      gap="$s"
      borderWidth={1}
      borderColor="rgba(101, 216, 255, 0.18)"
      borderRadius="$m"
      padding="$m"
      backgroundColor="rgba(255, 255, 255, 0.028)"
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$s">
        <SizableText
          size="$s"
          color="rgba(101, 216, 255, 0.72)"
          textTransform="uppercase"
          letterSpacing={0}
        >
          Recent runs
        </SizableText>
        <XStack
          onPress={onFollowLatest}
          cursor="pointer"
          borderWidth={1}
          borderColor={
            followLatest
              ? 'rgba(71, 246, 164, 0.34)'
              : 'rgba(101, 216, 255, 0.22)'
          }
          borderRadius="$s"
          paddingHorizontal="$s"
          paddingVertical="$2xs"
          backgroundColor={
            followLatest
              ? 'rgba(71, 246, 164, 0.08)'
              : 'rgba(101, 216, 255, 0.045)'
          }
        >
          <SizableText
            size="$s"
            color={followLatest ? '#47f6a4' : 'rgba(240, 250, 255, 0.68)'}
          >
            Latest
          </SizableText>
        </XStack>
      </XStack>

      <YStack gap="$xs">
        {runs.slice(0, 8).map((event) => {
          const selected = !followLatest && activeLensId === event.lens.lensId;
          const tone = statusTone(event.lens.status);
          return (
            <YStack
              key={event.lens.lensId}
              onPress={() => onSelectRun(event)}
              cursor="pointer"
              gap="$2xs"
              minWidth={0}
              borderWidth={1}
              borderColor={
                selected
                  ? 'rgba(150, 240, 255, 0.56)'
                  : 'rgba(101, 216, 255, 0.14)'
              }
              borderLeftWidth={2}
              borderLeftColor={tone}
              borderRadius="$s"
              paddingHorizontal="$s"
              paddingVertical="$xs"
              backgroundColor={
                selected
                  ? 'rgba(101, 216, 255, 0.09)'
                  : 'rgba(101, 216, 255, 0.035)'
              }
              shadowColor={selected ? '#96f0ff' : 'transparent'}
              shadowOpacity={selected ? 0.12 : 0}
              shadowRadius={selected ? 12 : 0}
            >
              <XStack
                alignItems="center"
                justifyContent="space-between"
                gap="$s"
              >
                <XStack alignItems="center" gap="$xs" flex={1} minWidth={0}>
                  <View
                    width={7}
                    height={7}
                    borderRadius={999}
                    backgroundColor={tone}
                  />
                  <SizableText
                    size="$s"
                    color="rgba(248, 252, 255, 0.88)"
                    flex={1}
                    minWidth={0}
                    numberOfLines={1}
                  >
                    {statusLabel(event.lens.status)}
                  </SizableText>
                </XStack>
                <SizableText
                  size="$s"
                  color="rgba(240, 250, 255, 0.42)"
                  flexShrink={0}
                >
                  {formatWallTime(event.lens.updatedAt)}
                </SizableText>
              </XStack>
              <SizableText
                size="$s"
                color="rgba(240, 250, 255, 0.68)"
                numberOfLines={2}
              >
                {runPreview(event.lens)}
              </SizableText>
              <SizableText size="$s" color="rgba(240, 250, 255, 0.42)">
                {runMeta(event.lens)}
              </SizableText>
            </YStack>
          );
        })}
      </YStack>
    </YStack>
  );
}

export function ContextLensPanel({
  events,
  streamStatus,
  selectedMessage,
  onClearSelectedMessage,
  width = 360,
}: {
  events: ContextLensEvent[];
  streamStatus: LensStreamState['status'];
  selectedMessage?: ContextLensSelectedMessage | null;
  onClearSelectedMessage?: () => void;
  width?: number | '100%';
}) {
  const [selectedRun, setSelectedRun] = useState<ContextLensEvent | null>(null);
  const [lookupResult, setLookupResult] = useState<{
    key: string;
    lens: ContextLens;
  } | null>(null);
  const [lookupStatus, setLookupStatus] = useState<
    'idle' | 'loading' | 'missing' | 'error'
  >('idle');
  const runs = useContextLensRuns(events);
  const selectedMessageKey = selectedMessage
    ? `${selectedMessage.lensId ?? ''}/${selectedMessage.authorId ?? ''}/${selectedMessage.id}`
    : null;

  useEffect(() => {
    if (selectedMessageKey) {
      setSelectedRun(null);
    }
  }, [selectedMessageKey]);

  const selectedEvent = selectedMessage
    ? findEventForMessage(events, selectedMessage)
    : undefined;
  const selectedLookupEvent =
    selectedMessage && lookupResult?.key === selectedMessageKey
      ? ({
          seq: 0,
          at: lookupResult.lens.updatedAt,
          phase: 'lookup',
          lens: lookupResult.lens,
        } satisfies ContextLensEvent)
      : undefined;
  const selectedRunEvent = selectedRun
    ? findEventForLensId(events, selectedRun.lens.lensId) ?? selectedRun
    : undefined;
  const panelMode = selectedRun ? 'run' : selectedMessage ? 'selected' : 'live';
  const latest =
    panelMode === 'run'
      ? selectedRunEvent
      : panelMode === 'selected'
        ? selectedEvent ?? selectedLookupEvent
        : runs[0];
  const eventTrail = latest
    ? events.filter((event) => event.lens.lensId === latest.lens.lensId)
    : [];
  const runTimeline = latest
    ? buildRunTimeline(eventTrail.length ? eventTrail : [latest], latest)
    : [];
  const activeCount = runs.filter(
    (event) => !FINAL_STATUSES.has(event.lens.status)
  ).length;
  const followLatest = panelMode === 'live';

  const followLatestRun = () => {
    setSelectedRun(null);
    onClearSelectedMessage?.();
  };

  const selectRun = (event: ContextLensEvent) => {
    setSelectedRun(event);
    onClearSelectedMessage?.();
  };

  useEffect(() => {
    const gatewayBaseUrl = getGatewayBaseUrl();
    if (!selectedMessage || selectedEvent || !gatewayBaseUrl) {
      setLookupResult(null);
      setLookupStatus(selectedMessage && selectedEvent ? 'idle' : 'idle');
      return;
    }

    let cancelled = false;
    setLookupStatus('loading');
    setLookupResult(null);

    if (!selectedMessage.lensId) {
      setLookupStatus('missing');
      return () => {
        cancelled = true;
      };
    }

    fetch(
      `${gatewayBaseUrl}/tlon/context-lens/run?lensId=${encodeQuery(selectedMessage.lensId)}`
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { lens?: ContextLens } | null) => {
        if (cancelled) {
          return;
        }
        if (payload?.lens) {
          setLookupResult({
            key: selectedMessageKey ?? '',
            lens: payload.lens,
          });
          setLookupStatus('idle');
          return;
        }
        setLookupStatus('missing');
      })
      .catch(() => {
        if (!cancelled) {
          setLookupStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEvent, selectedMessage, selectedMessageKey]);

  return (
    <YStack
      testID="ContextLensPanel"
      width={width}
      height="100%"
      borderLeftWidth={1}
      borderColor="rgba(101, 216, 255, 0.24)"
      backgroundColor="rgba(8, 14, 20, 0.86)"
      padding="$l"
      gap="$l"
      shadowColor="rgba(0, 0, 0, 0.35)"
      shadowRadius={24}
      shadowOpacity={0.35}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <YStack gap="$2xs">
          <SizableText
            size="$s"
            color="#65d8ff"
            textTransform="uppercase"
            letterSpacing={0}
          >
            Context Lens
          </SizableText>
          <SizableText size="$m" color="rgba(240, 250, 255, 0.72)">
            {panelMode === 'selected'
              ? 'Selected response'
              : panelMode === 'run'
                ? 'Selected run'
                : activeCount
                  ? `${activeCount} live run`
                  : 'Run inspector'}
          </SizableText>
        </YStack>
        <XStack
          alignItems="center"
          gap="$xs"
          borderWidth={1}
          borderColor="rgba(71, 246, 164, 0.28)"
          borderRadius="$s"
          paddingHorizontal="$s"
          paddingVertical="$2xs"
          backgroundColor="rgba(71, 246, 164, 0.08)"
        >
          <View
            width={6}
            height={6}
            borderRadius={999}
            backgroundColor={
              streamStatus === 'connected' ? '#47f6a4' : '#ffd166'
            }
          />
          <SizableText size="$s" color="rgba(240, 250, 255, 0.76)">
            {streamStatus}
          </SizableText>
        </XStack>
      </XStack>

      {panelMode === 'selected' ? (
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$s"
          minWidth={0}
          borderWidth={1}
          borderColor="rgba(101, 216, 255, 0.22)"
          borderRadius="$s"
          paddingHorizontal="$s"
          paddingVertical="$xs"
          backgroundColor="rgba(101, 216, 255, 0.055)"
        >
          <YStack flex={1} minWidth={0} gap="$2xs">
            <SizableText size="$s" color="rgba(240, 250, 255, 0.46)">
              Inspecting
            </SizableText>
            <SizableText
              size="$s"
              color="rgba(240, 250, 255, 0.76)"
              flex={1}
              minWidth={0}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {selectedMessage?.authorId ? `${selectedMessage.authorId}/` : ''}
              {selectedMessage?.id}
            </SizableText>
          </YStack>
          <XStack
            onPress={onClearSelectedMessage}
            cursor="pointer"
            flexShrink={0}
            paddingHorizontal="$xs"
            paddingVertical="$2xs"
          >
            <SizableText size="$s" color="#65d8ff">
              Latest
            </SizableText>
          </XStack>
        </XStack>
      ) : null}

      {panelMode === 'run' ? (
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$s"
          minWidth={0}
          borderWidth={1}
          borderColor="rgba(101, 216, 255, 0.22)"
          borderRadius="$s"
          paddingHorizontal="$s"
          paddingVertical="$xs"
          backgroundColor="rgba(101, 216, 255, 0.055)"
        >
          <YStack flex={1} minWidth={0} gap="$2xs">
            <SizableText size="$s" color="rgba(240, 250, 255, 0.46)">
              Inspecting run
            </SizableText>
            <SizableText
              size="$s"
              color="rgba(240, 250, 255, 0.76)"
              flex={1}
              minWidth={0}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {selectedRun?.lens.lensId}
            </SizableText>
          </YStack>
          <XStack
            onPress={followLatestRun}
            cursor="pointer"
            flexShrink={0}
            paddingHorizontal="$xs"
            paddingVertical="$2xs"
          >
            <SizableText size="$s" color="#65d8ff">
              Latest
            </SizableText>
          </XStack>
        </XStack>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$m" paddingBottom="$2xl">
          <RecentRunList
            runs={runs}
            activeLensId={latest?.lens.lensId}
            followLatest={followLatest}
            onSelectRun={selectRun}
            onFollowLatest={followLatestRun}
          />

          {panelMode === 'selected' && !latest && lookupStatus === 'loading' ? (
            <EmptySelectedRun lookupStatus="loading" />
          ) : panelMode === 'selected' && !latest ? (
            <EmptySelectedRun lookupStatus={lookupStatus} />
          ) : latest ? (
            <YStack
              gap="$m"
              borderWidth={1}
              borderColor="rgba(101, 216, 255, 0.22)"
              borderRadius="$m"
              padding="$m"
              backgroundColor="rgba(255, 255, 255, 0.045)"
            >
              <XStack alignItems="center" justifyContent="space-between">
                <XStack alignItems="center" gap="$s">
                  <View
                    width={9}
                    height={9}
                    borderRadius={999}
                    backgroundColor={statusTone(latest.lens.status)}
                  />
                  <SizableText size="$l" color="rgba(248, 252, 255, 0.95)">
                    {statusLabel(latest.lens.status)}
                  </SizableText>
                </XStack>
                <SizableText size="$s" color="rgba(240, 250, 255, 0.54)">
                  {latest.phase}
                </SizableText>
              </XStack>

              <YStack gap="$s">
                <Metric label="Context" value={summarizeContext(latest.lens)} />
                <Metric
                  label="Tools"
                  value={
                    latest.lens.tools.callCount
                      ? `${latest.lens.tools.callCount} / ${latest.lens.tools.called.join(', ')}`
                      : 'none'
                  }
                />
                <Metric label="Writes" value={summarizeWrites(latest.lens)} />
                <Metric
                  label="Model"
                  value={
                    latest.lens.provider || latest.lens.model
                      ? [latest.lens.provider, latest.lens.model]
                          .filter(Boolean)
                          .join(' / ')
                      : 'pending'
                  }
                />
                <Metric
                  label="Runtime"
                  value={formatDuration(latest.lens.lifecycle.durationMs)}
                />
              </YStack>

              {latest.lens.error ? (
                <SizableText size="$s" color="#ff8bad">
                  {latest.lens.error}
                </SizableText>
              ) : null}
            </YStack>
          ) : (
            <YStack
              alignItems="center"
              justifyContent="center"
              minHeight={180}
              gap="$m"
              borderWidth={1}
              borderColor="rgba(101, 216, 255, 0.18)"
              borderRadius="$m"
              backgroundColor="rgba(255, 255, 255, 0.035)"
            >
              <Icon type="Command" color="$positiveActionText" />
              <SizableText
                size="$m"
                color="rgba(240, 250, 255, 0.66)"
                textAlign="center"
              >
                Waiting for the next bot run
              </SizableText>
            </YStack>
          )}

          {latest ? <RunInspector lens={latest.lens} /> : null}

          {runTimeline.length ? (
            <YStack gap="$s">
              <SizableText
                size="$s"
                color="rgba(101, 216, 255, 0.72)"
                textTransform="uppercase"
                letterSpacing={0}
              >
                Run timeline
              </SizableText>
              {runTimeline.map((row, index) => (
                <TimelineItem
                  key={row.key}
                  row={row}
                  isLast={index === runTimeline.length - 1}
                />
              ))}
            </YStack>
          ) : null}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function TimelineItem({ row, isLast }: { row: TimelineRow; isLast: boolean }) {
  return (
    <XStack gap="$s" alignItems="stretch">
      <YStack alignItems="center" width={14}>
        <View
          width={7}
          height={7}
          borderRadius={999}
          marginTop={10}
          backgroundColor={row.tone}
          shadowColor={row.tone}
          shadowRadius={row.active ? 8 : 0}
          shadowOpacity={row.active ? 0.6 : 0}
        />
        {!isLast ? (
          <View
            flex={1}
            width={1}
            marginTop="$2xs"
            backgroundColor={TIMELINE_BORDER}
          />
        ) : null}
      </YStack>
      <YStack
        flex={1}
        gap="$2xs"
        borderWidth={1}
        borderColor={row.active ? TIMELINE_ACTIVE_BORDER : TIMELINE_BORDER}
        borderRadius="$s"
        paddingHorizontal="$s"
        paddingVertical="$xs"
        backgroundColor={
          row.active ? TIMELINE_ACTIVE_BACKGROUND : TIMELINE_BACKGROUND
        }
        shadowColor={row.active ? '#96f0ff' : 'transparent'}
        shadowOpacity={row.active ? 0.18 : 0}
        shadowRadius={row.active ? 14 : 0}
      >
        <XStack alignItems="center" justifyContent="space-between" gap="$s">
          <SizableText size="$s" color="rgba(248, 252, 255, 0.9)" flex={1}>
            {row.title}
          </SizableText>
          <SizableText size="$s" color="rgba(240, 250, 255, 0.42)">
            {row.meta}
          </SizableText>
        </XStack>
        <SizableText size="$s" color="rgba(240, 250, 255, 0.56)">
          {row.detail}
        </SizableText>
      </YStack>
    </XStack>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <XStack
      alignItems="flex-start"
      justifyContent="space-between"
      gap="$m"
      minWidth={0}
    >
      <SizableText size="$s" color="rgba(240, 250, 255, 0.5)" flexShrink={0}>
        {label}
      </SizableText>
      <SizableText
        size="$s"
        color="rgba(248, 252, 255, 0.88)"
        textAlign="right"
        flex={1}
        minWidth={0}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {value}
      </SizableText>
    </XStack>
  );
}
