import { lensRunMatchesChannel } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Icon, Pressable } from '@tloncorp/ui';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, SizableText, View, XStack, YStack } from 'tamagui';

import { RecentRunList } from './RecentRunList';
import { RunInspector } from './RunInspector';
import { RunSummary } from './RunSummary';
import { RunTimeline, buildRunTimeline } from './RunTimeline';
import { TONE_COLORS } from './format';
import { fetchContextLensRun } from './gatewayClient';
import {
  type ContextLens,
  type ContextLensEvent,
  type ContextLensSelectedMessage,
  FINAL_STATUSES,
  type LensStreamState,
  lensFromRunPayload,
} from './types';
import {
  liveEventMatchesChannel,
  useContextLensGatewayConfig,
  useContextLensRuns,
} from './useContextLensStore';

// Channel filtering happens in JS against synced payloads, so widen the fetch
// when scoped to a channel; the default-50 page can otherwise crop out older
// channel runs when there are more recent runs elsewhere. Mirrors the narrow
// ContextLensRuns screen.
const CHANNEL_FILTER_RUN_LIMIT = 500;

// When a run appears in both the live gateway stream and the synced ship
// table, keep the more authoritative record: a finalized run beats an
// in-flight one (SSE can miss the terminal event), otherwise the newest.
function prefersEvent(candidate: ContextLensEvent, existing: ContextLensEvent) {
  const candidateFinal = FINAL_STATUSES.has(candidate.lens.status);
  const existingFinal = FINAL_STATUSES.has(existing.lens.status);
  if (candidateFinal !== existingFinal) {
    return candidateFinal;
  }
  return candidate.at >= existing.at;
}

// Keep `fallback` unless the (optional) live `candidate` is more authoritative
// (final beats in-flight, newer beats older). Prevents a stale in-flight live
// gateway event from overriding a finalized synced record.
function preferred(
  candidate: ContextLensEvent | undefined,
  fallback: ContextLensEvent
): ContextLensEvent {
  return candidate && prefersEvent(candidate, fallback) ? candidate : fallback;
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
  streamStatus,
  selectedMessage,
  onClearSelectedMessage,
  channelId,
}: {
  events: ContextLensEvent[];
  streamStatus: LensStreamState['status'];
  selectedMessage?: ContextLensSelectedMessage | null;
  onClearSelectedMessage?: () => void;
  channelId?: string;
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
  const allLiveRuns = useContextLensRuns(events);
  // synced %context-lens records back the list when the gateway stream is absent
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
  const liveRuns = useMemo(
    () =>
      channelId
        ? allLiveRuns.filter((event) =>
            liveEventMatchesChannel(event, channelId, botShipByLensId)
          )
        : allLiveRuns,
    [allLiveRuns, channelId, botShipByLensId]
  );
  const runs = useMemo(() => {
    const synced: ContextLensEvent[] = (recentRunsQuery.data ?? []).flatMap(
      (row) => {
        if (channelId && !lensRunMatchesChannel(row, channelId)) {
          return [];
        }
        const lens = lensFromRunPayload(row.payload);
        return lens
          ? [{ seq: 0, at: lens.updatedAt, phase: 'sync', lens }]
          : [];
      }
    );
    // merge both sources by lensId, keeping the more authoritative record
    const byLensId = new Map<string, ContextLensEvent>();
    const consider = (event: ContextLensEvent) => {
      const existing = byLensId.get(event.lens.lensId);
      if (!existing || prefersEvent(event, existing)) {
        byLensId.set(event.lens.lensId, event);
      }
    };
    liveRuns.forEach(consider);
    synced.forEach(consider);
    return [...byLensId.values()].sort((left, right) => right.at - left.at);
  }, [liveRuns, recentRunsQuery.data, channelId]);
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
  // Read the selected run from the merged history (live + synced, final
  // preferred) so the inspector tracks a finalized synced row instead of
  // staying pinned to the stale snapshot captured at selection time. Fall back
  // to the frozen selection if it has aged out of the list.
  const selectedRunEvent = selectedRun
    ? (runs.find((event) => event.lens.lensId === selectedRun.lens.lensId) ??
      selectedRun)
    : undefined;
  // prefer the more authoritative of the live event and the synced lookup so a
  // stale in-flight live snapshot can't mask a finalized synced row
  const selectedDetail =
    selectedEvent && selectedLookupEvent
      ? preferred(selectedEvent, selectedLookupEvent)
      : (selectedEvent ?? selectedLookupEvent);
  const panelMode = selectedRun ? 'run' : selectedMessage ? 'selected' : 'live';
  const latest =
    panelMode === 'run'
      ? selectedRunEvent
      : panelMode === 'selected'
        ? selectedDetail
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
    // Skip the db-first lookup only when there's no selection, or the live
    // event is already final (authoritative). A non-final live event must not
    // suppress the lookup, or a missed terminal SSE event would pin the panel
    // to a stale in-flight snapshot instead of the finalized synced row.
    if (
      !selectedMessage ||
      (selectedEvent && FINAL_STATUSES.has(selectedEvent.lens.status))
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
      width={360}
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

          {latest ? <RunInspector lens={latest.lens} /> : null}

          <RunTimeline rows={runTimeline} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
