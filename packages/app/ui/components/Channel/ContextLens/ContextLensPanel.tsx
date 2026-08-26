import { lensRunMatchesChannel } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Icon, Pressable } from '@tloncorp/ui';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, SizableText, View, XStack, YStack } from 'tamagui';

import { CopyRawPayloadButton } from './CopyRawPayloadButton';
import { RecentRunList } from './RecentRunList';
import { RunInspector } from './RunInspector';
import { RunSummary } from './RunSummary';
import { RunTimeline, buildRunTimeline } from './RunTimeline';
import { TONE_COLORS } from './format';
import { fetchContextLensRun } from './gatewayClient';
import {
  type ContextLensRawEventSource,
  contextLensSourceFromLookup,
  contextLensSourceFromStewardRun,
  contextLensSourcesFromLiveEvents,
  mergeContextLensRunSources,
  preferredContextLensSource,
} from './rawEventSources';
import {
  type ContextLensEvent,
  type ContextLensSelectedMessage,
  FINAL_STATUSES,
  type LensStreamState,
} from './types';
import {
  liveEventMatchesChannel,
  useContextLensGatewayConfig,
} from './useContextLensStore';

// Channel filtering happens in JS against synced payloads, so widen the fetch
// when scoped to a channel; the default-50 page can otherwise crop out older
// channel runs when there are more recent runs elsewhere. Mirrors the narrow
// ContextLensRuns screen.
const CHANNEL_FILTER_RUN_LIMIT = 500;

function findSourceForLensId(
  sources: readonly ContextLensRawEventSource[],
  lensId: string
) {
  return sources.find((source) => source.event.lens.lensId === lensId);
}

function findSourceForMessage(
  sources: readonly ContextLensRawEventSource[],
  selected: ContextLensSelectedMessage
) {
  if (selected.lensId) {
    return findSourceForLensId(sources, selected.lensId);
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
        Run records sync from your ship and are retained for about 30 days. This
        message&rsquo;s run is no longer available.
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
  rawEvents,
  streamStatus,
  selectedMessage,
  onClearSelectedMessage,
  channelId,
  overlay = false,
}: {
  events: ContextLensEvent[];
  rawEvents: ContextLensEvent[];
  streamStatus: LensStreamState['status'];
  selectedMessage?: ContextLensSelectedMessage | null;
  onClearSelectedMessage?: () => void;
  channelId?: string;
  overlay?: boolean;
}) {
  const gatewayConfig = useContextLensGatewayConfig();
  const [selectedRun, setSelectedRun] =
    useState<ContextLensRawEventSource | null>(null);
  const [runHistoryOpen, setRunHistoryOpen] = useState(false);
  const [visibleRunCount, setVisibleRunCount] = useState(8);
  const [lookupResult, setLookupResult] = useState<{
    key: string;
    source: ContextLensRawEventSource;
  } | null>(null);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const allLiveSources = useMemo(
    () => contextLensSourcesFromLiveEvents(events, rawEvents),
    [events, rawEvents]
  );
  // Synced %steward lens records back the list when the gateway stream is absent
  // (mobile, remote) and keep history across gateway restarts. widen the fetch
  // when scoped so channel filtering (JS, against payloads) has enough to work
  // with.
  const recentRunsQuery = store.useRecentContextLensRuns(
    channelId ? CHANNEL_FILTER_RUN_LIMIT : undefined
  );
  const botShipByLensId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of recentRunsQuery.data ?? []) {
      map.set(row.lensId, row.botShip);
    }
    return map;
  }, [recentRunsQuery.data]);
  // both sources are global; when the panel is scoped to a channel, filter to
  // runs belonging to it so an unrelated DM/group run can't take over the view
  const liveSources = useMemo(
    () =>
      channelId
        ? allLiveSources.filter((source) =>
            liveEventMatchesChannel(source.event, channelId, botShipByLensId)
          )
        : allLiveSources,
    [allLiveSources, channelId, botShipByLensId]
  );
  const runSources = useMemo(() => {
    const synced = (recentRunsQuery.data ?? []).flatMap((row) => {
      if (channelId && !lensRunMatchesChannel(row, channelId)) {
        return [];
      }
      const source = contextLensSourceFromStewardRun(row);
      return source ? [source] : [];
    });
    return mergeContextLensRunSources(liveSources, synced);
  }, [liveSources, recentRunsQuery.data, channelId]);
  const runs = useMemo(
    () => runSources.map((source) => source.event),
    [runSources]
  );
  const selectedMessageKey = selectedMessage
    ? `${selectedMessage.lensId ?? ''}/${selectedMessage.authorId ?? ''}/${selectedMessage.id}`
    : null;

  useEffect(() => {
    if (selectedMessageKey) {
      setSelectedRun(null);
    }
  }, [selectedMessageKey]);

  const selectedSource = selectedMessage
    ? findSourceForMessage(runSources, selectedMessage)
    : undefined;
  const selectedLookupSource =
    selectedMessage && lookupResult?.key === selectedMessageKey
      ? lookupResult.source
      : undefined;
  // Read the selected run from the merged history (live + synced, final
  // preferred) so the inspector tracks a finalized synced row instead of
  // staying pinned to the stale snapshot captured at selection time. Fall back
  // to the frozen selection if it has aged out of the list.
  const selectedRunSource = selectedRun
    ? findSourceForLensId(runSources, selectedRun.event.lens.lensId) ??
      selectedRun
    : undefined;
  // prefer the more authoritative of the live event and the synced lookup so a
  // stale in-flight live snapshot can't mask a finalized synced row
  const selectedDetailSource =
    selectedSource && selectedLookupSource
      ? preferredContextLensSource(selectedSource, selectedLookupSource)
      : selectedSource ?? selectedLookupSource;
  const panelMode = selectedRun ? 'run' : selectedMessage ? 'selected' : 'live';
  const latestSource =
    panelMode === 'run'
      ? selectedRunSource
      : panelMode === 'selected'
        ? selectedDetailSource
        : runSources[0];
  const latest = latestSource?.event;
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
    const source = findSourceForLensId(runSources, event.lens.lensId);
    if (!source) {
      return;
    }
    setSelectedRun(source);
    setRunHistoryOpen(false);
    onClearSelectedMessage?.();
  };

  useEffect(() => {
    // Skip the db-first lookup only when there's no selection, or the live
    // event is already final (authoritative). A non-final live event must not
    // suppress the lookup, or a missed terminal SSE event would pin the panel
    // to a stale in-flight snapshot instead of the finalized synced row.
    if (
      !selectedMessage ||
      (selectedSource && FINAL_STATUSES.has(selectedSource.event.lens.status))
    ) {
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
    const resolve = async (): Promise<ContextLensRawEventSource | null> => {
      // synced %context-lens record first (works on every platform), then the
      // gateway's full run record as a live-gateway enhancement
      if (botShip) {
        const run = await store
          .ensureContextLensRun({ botShip, lensId })
          .catch(() => null);
        if (controller.signal.aborted) {
          return null;
        }
        const source = run ? contextLensSourceFromStewardRun(run) : null;
        if (source) {
          return source;
        }
      }
      if (gatewayConfig) {
        const lookup = await fetchContextLensRun(
          gatewayConfig,
          lensId,
          controller.signal
        );
        return lookup
          ? contextLensSourceFromLookup(lookup.lens, lookup.rawEnvelope)
          : null;
      }
      return null;
    };

    resolve()
      .then((source) => {
        if (controller.signal.aborted) {
          return;
        }
        if (source) {
          setLookupResult({ key: selectedMessageKey ?? '', source });
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
  }, [gatewayConfig, selectedSource, selectedMessage, selectedMessageKey]);

  return (
    <YStack
      testID="ContextLensPanel"
      width={360}
      maxWidth="100%"
      height="100%"
      position={overlay ? 'absolute' : 'relative'}
      top={overlay ? 0 : undefined}
      right={overlay ? 0 : undefined}
      bottom={overlay ? 0 : undefined}
      zIndex={overlay ? 2 : undefined}
      flexShrink={0}
      borderLeftWidth={1}
      borderColor="$border"
      backgroundColor="$background"
      shadowColor={overlay ? '$shadow' : undefined}
      shadowOffset={overlay ? { width: -4, height: 0 } : undefined}
      shadowOpacity={overlay ? 0.12 : undefined}
      shadowRadius={overlay ? 12 : undefined}
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
        <XStack alignItems="center" gap="$xs" flexShrink={0}>
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
          <CopyRawPayloadButton payload={latestSource?.rawEnvelope} />
        </XStack>
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
          value={selectedRun?.event.lens.lensId ?? ''}
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
            <RunSummary
              lens={latest.lens}
              phase={latest.phase}
              onRetry={(() => {
                const lensId = latest.lens.lensId;
                const botShip =
                  botShipByLensId.get(lensId) ??
                  selectedMessage?.botShip ??
                  null;
                return botShip
                  ? () => store.retryLensRun({ botShip, lensId })
                  : undefined;
              })()}
            />
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

          {latest ? (
            <RunInspector
              lens={latest.lens}
              activityEvents={eventTrail.flatMap((event) =>
                event.detail?.activity ? [event.detail.activity] : []
              )}
            />
          ) : null}

          <RunTimeline rows={runTimeline} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
