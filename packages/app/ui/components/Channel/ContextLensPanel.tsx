import { Icon } from '@tloncorp/ui';
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
  chatType: 'dm' | 'channel';
  trigger: string;
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
  };
  persistence: {
    postsReply: boolean;
    updatesSettings: boolean;
    writesMedia: boolean;
    emitsTelemetry: boolean;
    cachesHistory: boolean;
  };
  tools: {
    ownerOnlyAvailable: string[];
    called: string[];
    callCount: number;
    lastStartedAt: number | null;
  };
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

export type ContextLensEvent = {
  seq: number;
  at: number;
  phase: string;
  lens: ContextLens;
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

function getGatewayBaseUrl() {
  if (Platform.OS !== 'web') {
    return null;
  }

  const stored =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('tlon.contextLens.gatewayUrl')?.trim()
      : null;
  return stored || 'http://localhost:18789';
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

export function ContextLensPanel({
  events,
  streamStatus,
  width = 360,
}: {
  events: ContextLensEvent[];
  streamStatus: LensStreamState['status'];
  width?: number | '100%';
}) {
  const runs = useContextLensRuns(events);
  const latest = runs[0];
  const eventTrail = latest
    ? events.filter((event) => event.lens.lensId === latest.lens.lensId).slice(-14)
    : [];
  const activeCount = runs.filter(
    (event) => !FINAL_STATUSES.has(event.lens.status)
  ).length;

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
            {activeCount ? `${activeCount} live run` : 'Run telemetry'}
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

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$m" paddingBottom="$2xl">
          {latest ? (
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

          {eventTrail.length ? (
            <YStack gap="$s">
              <SizableText
                size="$s"
                color="rgba(101, 216, 255, 0.72)"
                textTransform="uppercase"
                letterSpacing={0}
              >
                Live trail
              </SizableText>
              {eventTrail.map((event) => (
                <XStack
                  key={event.seq}
                  gap="$s"
                  alignItems="flex-start"
                  borderLeftWidth={1}
                  borderColor="rgba(101, 216, 255, 0.3)"
                  paddingLeft="$s"
                  paddingVertical="$2xs"
                >
                  <SizableText size="$s" color="rgba(240, 250, 255, 0.48)">
                    #{event.seq}
                  </SizableText>
                  <YStack flex={1}>
                    <SizableText size="$s" color="rgba(248, 252, 255, 0.86)">
                      {event.phase}
                    </SizableText>
                    <SizableText size="$s" color="rgba(240, 250, 255, 0.5)">
                      {statusLabel(event.lens.status)}
                    </SizableText>
                  </YStack>
                </XStack>
              ))}
            </YStack>
          ) : null}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <XStack alignItems="flex-start" justifyContent="space-between" gap="$m">
      <SizableText size="$s" color="rgba(240, 250, 255, 0.5)">
        {label}
      </SizableText>
      <SizableText
        size="$s"
        color="rgba(248, 252, 255, 0.88)"
        textAlign="right"
        flex={1}
      >
        {value}
      </SizableText>
    </XStack>
  );
}
