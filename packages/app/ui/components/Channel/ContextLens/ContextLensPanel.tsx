import * as store from '@tloncorp/shared/store';
import { Icon, Pressable } from '@tloncorp/ui';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, SizableText, View, XStack, YStack } from 'tamagui';

import { RecentRunList } from './RecentRunList';
import { RunInspector } from './RunInspector';
import { RunTimeline, buildRunTimeline } from './RunTimeline';
import {
  TONE_COLORS,
  formatDuration,
  runKindLabel,
  statusLabel,
  statusTone,
  summarizeContext,
  summarizeWrites,
} from './format';
import { fetchContextLensRun } from './gatewayClient';
import { Metric } from './primitives';
import {
  type ContextLens,
  type ContextLensEvent,
  type ContextLensSelectedMessage,
  FINAL_STATUSES,
  type LensStreamState,
  lensFromRunPayload,
} from './types';
import {
  useContextLensGatewayConfig,
  useContextLensRuns,
} from './useContextLensStore';

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

type LookupStatus = 'idle' | 'loading' | 'missing' | 'error';

function EmptySelectedRun({ lookupStatus }: { lookupStatus: LookupStatus }) {
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
      borderColor="$border"
      borderRadius="$m"
      backgroundColor="$secondaryBackground"
      padding="$m"
    >
      <Icon type="Info" color="$positiveActionText" />
      <SizableText size="$m" color="$secondaryText" textAlign="center">
        {copy}
      </SizableText>
      <SizableText size="$s" color="$tertiaryText" textAlign="center">
        Run records sync from your ship and are retained for about 30 days.
        This message&rsquo;s run is no longer available.
      </SizableText>
    </YStack>
  );
}

function InspectingBanner({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear?: () => void;
}) {
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$s"
      minWidth={0}
      borderWidth={1}
      borderColor="$border"
      borderRadius="$s"
      paddingHorizontal="$s"
      paddingVertical="$xs"
      backgroundColor="$secondaryBackground"
    >
      <YStack flex={1} minWidth={0} gap="$2xs">
        <SizableText size="$s" color="$tertiaryText">
          {label}
        </SizableText>
        <SizableText
          size="$s"
          color="$secondaryText"
          flex={1}
          minWidth={0}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {value}
        </SizableText>
      </YStack>
      <Pressable
        onPress={onClear}
        cursor="pointer"
        flexShrink={0}
        paddingHorizontal="$xs"
        paddingVertical="$2xs"
      >
        <SizableText size="$s" color="$positiveActionText">
          Latest
        </SizableText>
      </Pressable>
    </XStack>
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
  const gatewayConfig = useContextLensGatewayConfig();
  const [selectedRun, setSelectedRun] = useState<ContextLensEvent | null>(null);
  const [runHistoryOpen, setRunHistoryOpen] = useState(false);
  const [visibleRunCount, setVisibleRunCount] = useState(8);
  const [lookupResult, setLookupResult] = useState<{
    key: string;
    lens: ContextLens;
  } | null>(null);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const liveRuns = useContextLensRuns(events);
  // synced %context-lens records back the list when the gateway stream is absent
  // (mobile, remote) and keep history across gateway restarts
  const recentRunsQuery = store.useRecentContextLensRuns();
  const runs = useMemo(() => {
    const synced: ContextLensEvent[] = (recentRunsQuery.data ?? []).flatMap(
      (row) => {
        const lens = lensFromRunPayload(row.payload);
        return lens
          ? [{ seq: 0, at: lens.updatedAt, phase: 'sync', lens }]
          : [];
      }
    );
    const live = new Set(liveRuns.map((event) => event.lens.lensId));
    return [
      ...liveRuns,
      ...synced.filter((event) => !live.has(event.lens.lensId)),
    ].sort((left, right) => right.at - left.at);
  }, [liveRuns, recentRunsQuery.data]);
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
  const hasActiveRun = latest ? !FINAL_STATUSES.has(latest.lens.status) : false;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasActiveRun) {
      return;
    }
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [hasActiveRun]);
  const runTimeline = latest
    ? buildRunTimeline(eventTrail.length ? eventTrail : [latest], latest, now)
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
    setRunHistoryOpen(false);
    onClearSelectedMessage?.();
  };

  useEffect(() => {
    if (!selectedMessage || selectedEvent) {
      setLookupResult(null);
      setLookupStatus('idle');
      return;
    }

    setLookupResult(null);
    const { lensId, botShip } = selectedMessage;
    if (!lensId) {
      setLookupStatus('missing');
      return;
    }

    setLookupStatus('loading');
    const controller = new AbortController();
    const resolve = async (): Promise<ContextLens | null> => {
      // synced %context-lens record first (works on every platform), then the
      // gateway's full run record as a live-gateway enhancement
      if (botShip) {
        const run = await store
          .ensureContextLensRun({ botShip, lensId })
          .catch(() => null);
        if (controller.signal.aborted) {
          return null;
        }
        const lens = run ? lensFromRunPayload(run.payload) : null;
        if (lens) {
          return lens;
        }
      }
      if (gatewayConfig) {
        return fetchContextLensRun(gatewayConfig, lensId, controller.signal);
      }
      return null;
    };

    resolve()
      .then((lens) => {
        if (controller.signal.aborted) {
          return;
        }
        if (lens) {
          setLookupResult({ key: selectedMessageKey ?? '', lens });
          setLookupStatus('idle');
          return;
        }
        setLookupStatus('missing');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLookupStatus('error');
        }
      });

    return () => {
      controller.abort();
    };
  }, [gatewayConfig, selectedEvent, selectedMessage, selectedMessageKey]);

  return (
    <YStack
      testID="ContextLensPanel"
      width={width}
      height="100%"
      borderLeftWidth={1}
      borderColor="$border"
      backgroundColor="$background"
      padding="$l"
      gap="$l"
    >
      <XStack alignItems="center" justifyContent="space-between">
        <YStack gap="$2xs">
          <SizableText
            size="$s"
            color="$tertiaryText"
            textTransform="uppercase"
            letterSpacing={0}
          >
            Context Lens
          </SizableText>
          <SizableText size="$m" color="$secondaryText">
            {panelMode === 'selected'
              ? 'Selected response'
              : panelMode === 'run'
                ? 'Selected run'
                : activeCount
                  ? `${activeCount} live run`
                  : 'Run inspector'}
          </SizableText>
        </YStack>
        {streamStatus !== 'disabled' ? (
          <XStack
            alignItems="center"
            gap="$xs"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$s"
            paddingHorizontal="$s"
            paddingVertical="$2xs"
            backgroundColor="$secondaryBackground"
          >
            <View
              width={6}
              height={6}
              borderRadius={999}
              backgroundColor={
                streamStatus === 'connected'
                  ? TONE_COLORS.positive
                  : TONE_COLORS.warning
              }
            />
            <SizableText size="$s" color="$secondaryText">
              {streamStatus}
            </SizableText>
          </XStack>
        ) : null}
      </XStack>

      {panelMode === 'selected' ? (
        <InspectingBanner
          label="Inspecting"
          value={`${selectedMessage?.authorId ? `${selectedMessage.authorId}/` : ''}${selectedMessage?.id ?? ''}`}
          onClear={onClearSelectedMessage}
        />
      ) : null}

      {panelMode === 'run' ? (
        <InspectingBanner
          label="Inspecting run"
          value={selectedRun?.lens.lensId ?? ''}
          onClear={followLatestRun}
        />
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$m" paddingBottom="$2xl">
          <RecentRunList
            runs={runs}
            activeLensId={latest?.lens.lensId}
            followLatest={followLatest}
            expanded={runHistoryOpen}
            visibleCount={visibleRunCount}
            onSelectRun={selectRun}
            onFollowLatest={followLatestRun}
            onToggleExpanded={() => setRunHistoryOpen((open) => !open)}
            onShowMore={() =>
              setVisibleRunCount((count) => Math.min(count + 8, runs.length))
            }
          />

          {panelMode === 'selected' && !latest ? (
            <EmptySelectedRun lookupStatus={lookupStatus} />
          ) : latest ? (
            <YStack
              gap="$m"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$m"
              padding="$m"
              backgroundColor="$secondaryBackground"
            >
              <XStack alignItems="center" justifyContent="space-between">
                <XStack alignItems="center" gap="$s">
                  <View
                    width={9}
                    height={9}
                    borderRadius={999}
                    backgroundColor={
                      TONE_COLORS[statusTone(latest.lens.status)]
                    }
                  />
                  <SizableText size="$l" color="$primaryText">
                    {statusLabel(latest.lens.status)}
                  </SizableText>
                </XStack>
                <SizableText size="$s" color="$secondaryText">
                  {latest.phase}
                </SizableText>
              </XStack>

              <YStack gap="$s">
                <Metric label="Context" value={summarizeContext(latest.lens)} />
                <Metric label="Run" value={runKindLabel(latest.lens)} />
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
                <SizableText size="$s" color="$negativeActionText">
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
              borderColor="$border"
              borderRadius="$m"
              backgroundColor="$secondaryBackground"
            >
              <Icon type="Command" color="$positiveActionText" />
              <SizableText size="$m" color="$secondaryText" textAlign="center">
                Waiting for the next bot run
              </SizableText>
            </YStack>
          )}

          {latest ? <RunInspector lens={latest.lens} /> : null}

          <RunTimeline rows={runTimeline} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
