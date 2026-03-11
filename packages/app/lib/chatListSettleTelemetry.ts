import { fetch as fetchNetInfo } from '@react-native-community/netinfo';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';

const logger = createDevLogger('ChatListSettleTelemetry', false);
const CHATLIST_SETTLE_IDLE_MS = 2000;
const CHATLIST_IN_FLIGHT_CHECKPOINT_MS = 5000;
const TOP_CHAT_SNAPSHOT_ITEMS_PER_BUCKET = 10;
const CHATLIST_TIMING_EVENT = 'ChatList Sync Timing';

type ChatSettleTrigger = 'opened' | 'active';
type SyncSinceResult = 'success' | 'error';
type AppOpenKind = 'cold_open' | 'foreground_resume';

type ChatListSettleMeasurement = {
  trigger: ChatSettleTrigger;
  appOpenKind: AppOpenKind;
  startedAt: number;
  lastSignature: string | null;
  lastRenderedSignature: string | null;
  lastRenderAtMs: number | null;
  firstRenderedAtBySignature: Record<string, number>;
  latestDataPaintAtMs: number | null;
  changeCount: number;
  requiredSyncSource: 'syncSince' | 'none';
  syncCompleted: boolean;
  syncDurationMs: number | null;
  syncNodeBusyStatus: string | null;
  syncPostsCount: number | null;
  neededToSyncLatestPosts: boolean;
  syncResult: SyncSinceResult | 'not-required' | null;
  syncHadChanges: boolean | null;
  syncUnreadTargets: {
    channelUnreadCounts: Record<string, number>;
    groupUnreadCounts: Record<string, number>;
  } | null;
  syncUnreadTargetsMatched: boolean | null;
  syncCompletedAtMs: number | null;
  nativeCacheChecked: boolean;
  nativeCachePresent: boolean;
  nativeCacheApplied: boolean;
  nativeCacheReadMs: number | null;
  nativeCacheParseMs: number | null;
  nativeCacheInsertMs: number | null;
  nativeCacheTotalMs: number | null;
  cacheUnreadTargets: {
    channelUnreadCounts: Record<string, number>;
    groupUnreadCounts: Record<string, number>;
  } | null;
  cacheUnreadTargetsMatched: boolean | null;
  cacheDataMatchedAtMs: number | null;
  cacheRenderedAtMs: number | null;
  cacheRenderedSignature: string | null;
  postSyncSnapshotSeen: boolean;
  firstPaintDurationMs: number | null;
  waitingForSettledRender: boolean;
  settledDataAtMs: number | null;
  settledSignature: string | null;
  networkType: string | null;
  networkConnected: boolean | null;
  networkInternetReachable: boolean | null;
  cellularGeneration: string | null;
};

let measurement: ChatListSettleMeasurement | null = null;
let lastChats: db.GroupedChats | null = null;
let settleIdleTimer: ReturnType<typeof setTimeout> | null = null;
let settleCheckpointTimer: ReturnType<typeof setTimeout> | null = null;
let chatListIsFocused = false;
const measurementStartObservers = new Set<() => void>();

export function setChatListFocused(focused: boolean) {
  chatListIsFocused = focused;
}

function clearSettleTimers() {
  if (settleIdleTimer) {
    clearTimeout(settleIdleTimer);
    settleIdleTimer = null;
  }
  if (settleCheckpointTimer) {
    clearTimeout(settleCheckpointTimer);
    settleCheckpointTimer = null;
  }
}

function stopSettleMeasurement() {
  clearSettleTimers();
  measurement = null;
}

function buildChatSettleSignature(chats: db.GroupedChats) {
  const serialize = (section: 'pinned' | 'pending' | 'all', chats: db.Chat[]) =>
    chats
      .slice(0, TOP_CHAT_SNAPSHOT_ITEMS_PER_BUCKET)
      .map((chat) => `${section}:${chat.id}:${chat.unreadCount ?? 0}`)
      .join('|');

  return [
    serialize('pinned', chats.pinned),
    serialize('pending', chats.pending),
    serialize('all', chats.unpinned),
  ].join('|');
}

export function getChatListTelemetrySignature(chats: db.GroupedChats) {
  return buildChatSettleSignature(chats);
}

function captureTimingEvent(
  currentMeasurement: ChatListSettleMeasurement,
  outcome: 'settled' | 'checkpoint' | 'abandoned',
  settledStrategy: 'idle_window' | 'sync_render_match' | null = null,
  abandonedReason: 'inactive' | 'background' | null = null
) {
  const aboveTheFoldTerminalPaintDurationMs = currentMeasurement.lastRenderAtMs
    ? currentMeasurement.lastRenderAtMs - currentMeasurement.startedAt
    : null;
  const latestPaintDurationMs = currentMeasurement.latestDataPaintAtMs
    ? currentMeasurement.latestDataPaintAtMs - currentMeasurement.startedAt
    : null;
  const latestConfirmedDurationMs =
    outcome === 'settled' ? Date.now() - currentMeasurement.startedAt : null;
  const aboveTheFoldTerminalPaintMatchesData =
    currentMeasurement.lastRenderedSignature !== null &&
    currentMeasurement.lastSignature !== null
      ? currentMeasurement.lastRenderedSignature ===
        currentMeasurement.lastSignature
      : null;
  const aboveTheFoldCacheRenderDurationMs = currentMeasurement.cacheRenderedAtMs
    ? currentMeasurement.cacheRenderedAtMs - currentMeasurement.startedAt
    : null;
  const cacheVsGroundTruthDiverged =
    outcome === 'settled' &&
    currentMeasurement.cacheRenderedSignature &&
    currentMeasurement.settledSignature
      ? currentMeasurement.cacheRenderedSignature !==
        currentMeasurement.settledSignature
      : null;
  const syncUnreadPinnedTopItemMatched = getSyncUnreadSectionTopItemMatch(
    lastChats,
    currentMeasurement.syncUnreadTargets,
    'pinned'
  );
  const syncUnreadUnpinnedTopItemMatched = getSyncUnreadSectionTopItemMatch(
    lastChats,
    currentMeasurement.syncUnreadTargets,
    'unpinned'
  );
  const syncUnreadTopItemMatched = getAnySectionTopItemMatch(
    syncUnreadPinnedTopItemMatched,
    syncUnreadUnpinnedTopItemMatched
  );
  const groundTruthPath =
    currentMeasurement.nativeCacheApplied &&
    currentMeasurement.cacheRenderedAtMs !== null
      ? currentMeasurement.syncCompleted
        ? 'cache_then_sync'
        : 'cache_with_unfinished_sync'
      : currentMeasurement.syncCompleted
        ? 'sync_only'
        : null;

  logger.trackEvent(CHATLIST_TIMING_EVENT, {
    trigger: currentMeasurement.trigger,
    appOpenKind: currentMeasurement.appOpenKind,
    outcome,
    settledStrategy,
    abandonedReason,
    durationMs: Date.now() - currentMeasurement.startedAt,
    aboveTheFoldShuffleCount: currentMeasurement.changeCount,
    syncRequestCompleted: currentMeasurement.syncCompleted,
    requiredSyncSource: currentMeasurement.requiredSyncSource,
    syncResult: currentMeasurement.syncResult,
    syncDurationMs: currentMeasurement.syncDurationMs,
    nodeBusyStatus: currentMeasurement.syncNodeBusyStatus,
    syncPostsCount: currentMeasurement.syncPostsCount,
    neededToSyncLatestPosts: currentMeasurement.neededToSyncLatestPosts,
    syncHadChanges: currentMeasurement.syncHadChanges,
    syncUnreadTargetsMatched: currentMeasurement.syncUnreadTargetsMatched,
    syncUnreadTargetsCount:
      Object.keys(
        currentMeasurement.syncUnreadTargets?.channelUnreadCounts ?? {}
      ).length +
      Object.keys(currentMeasurement.syncUnreadTargets?.groupUnreadCounts ?? {})
        .length,
    nativeCacheChecked: currentMeasurement.nativeCacheChecked,
    nativeCachePresent: currentMeasurement.nativeCachePresent,
    nativeCacheApplied: currentMeasurement.nativeCacheApplied,
    nativeCacheTotalMs: currentMeasurement.nativeCacheTotalMs,
    aboveTheFoldTerminalPaintDurationMs,
    latestPaintDurationMs,
    latestConfirmedDurationMs,
    aboveTheFoldTerminalPaintMatchesData,
    cacheRenderDurationMs: aboveTheFoldCacheRenderDurationMs,
    cacheVsGroundTruthDiverged,
    groundTruthPath,
    syncUnreadTopItemMatched,
    syncToPaintMs:
      currentMeasurement.latestDataPaintAtMs != null &&
      currentMeasurement.syncCompletedAtMs != null
        ? currentMeasurement.latestDataPaintAtMs -
          currentMeasurement.syncCompletedAtMs
        : null,
    networkType: currentMeasurement.networkType,
    networkConnected: currentMeasurement.networkConnected,
    networkInternetReachable: currentMeasurement.networkInternetReachable,
    cellularGeneration: currentMeasurement.cellularGeneration,
  });
}

function maybeEmitSettled(
  currentMeasurement: ChatListSettleMeasurement,
  strategy: 'idle_window' | 'sync_render_match'
) {
  if (
    currentMeasurement.syncUnreadTargets &&
    !currentMeasurement.syncUnreadTargetsMatched
  ) {
    return false;
  }

  if (
    currentMeasurement.syncHadChanges &&
    !currentMeasurement.syncUnreadTargets &&
    !currentMeasurement.postSyncSnapshotSeen
  ) {
    return false;
  }

  if (
    !currentMeasurement.syncCompleted ||
    !currentMeasurement.lastSignature ||
    currentMeasurement.lastRenderedSignature !==
      currentMeasurement.lastSignature
  ) {
    return false;
  }

  if (!currentMeasurement.settledDataAtMs) {
    currentMeasurement.settledDataAtMs = Date.now();
  }
  currentMeasurement.settledSignature = currentMeasurement.lastSignature;
  if (currentMeasurement.settledSignature) {
    currentMeasurement.latestDataPaintAtMs =
      currentMeasurement.firstRenderedAtBySignature[
        currentMeasurement.settledSignature
      ] ??
      currentMeasurement.lastRenderAtMs ??
      null;
  }
  captureTimingEvent(currentMeasurement, 'settled', strategy);
  stopSettleMeasurement();
  return true;
}

function queueSettleIfReady(startedAt: number) {
  if (settleIdleTimer) {
    clearTimeout(settleIdleTimer);
  }

  settleIdleTimer = setTimeout(() => {
    const activeMeasurement = measurement;
    if (!activeMeasurement || activeMeasurement.startedAt !== startedAt) {
      return;
    }

    if (
      activeMeasurement.requiredSyncSource !== 'none' &&
      !activeMeasurement.syncCompleted
    ) {
      return;
    }

    activeMeasurement.settledDataAtMs = Date.now();
    activeMeasurement.settledSignature = activeMeasurement.lastSignature;

    if (maybeEmitSettled(activeMeasurement, 'idle_window')) {
      return;
    }

    activeMeasurement.waitingForSettledRender = true;
  }, CHATLIST_SETTLE_IDLE_MS);
}

export function startChatListSettleMeasurement(trigger: ChatSettleTrigger) {
  if (!chatListIsFocused) {
    return;
  }
  clearSettleTimers();
  const startedAt = Date.now();
  measurement = {
    trigger,
    appOpenKind: trigger === 'opened' ? 'cold_open' : 'foreground_resume',
    startedAt,
    lastSignature: null,
    lastRenderedSignature: null,
    lastRenderAtMs: null,
    firstRenderedAtBySignature: {},
    latestDataPaintAtMs: null,
    changeCount: 0,
    requiredSyncSource: 'syncSince',
    syncCompleted: false,
    syncDurationMs: null,
    syncNodeBusyStatus: null,
    syncPostsCount: null,
    neededToSyncLatestPosts: false,
    syncResult: null,
    syncHadChanges: null,
    syncUnreadTargets: null,
    syncUnreadTargetsMatched: null,
    syncCompletedAtMs: null,
    nativeCacheChecked: false,
    nativeCachePresent: false,
    nativeCacheApplied: false,
    nativeCacheReadMs: null,
    nativeCacheParseMs: null,
    nativeCacheInsertMs: null,
    nativeCacheTotalMs: null,
    cacheUnreadTargets: null,
    cacheUnreadTargetsMatched: null,
    cacheDataMatchedAtMs: null,
    cacheRenderedAtMs: null,
    cacheRenderedSignature: null,
    postSyncSnapshotSeen: false,
    firstPaintDurationMs: null,
    waitingForSettledRender: false,
    settledDataAtMs: null,
    settledSignature: null,
    networkType: null,
    networkConnected: null,
    networkInternetReachable: null,
    cellularGeneration: null,
  };
  fetchNetInfo().then((state) => {
    if (measurement && measurement.startedAt === startedAt) {
      measurement.networkType = state.type;
      measurement.networkConnected = state.isConnected ?? null;
      measurement.networkInternetReachable = state.isInternetReachable ?? null;
      measurement.cellularGeneration =
        state.type === 'cellular'
          ? state.details.cellularGeneration ?? null
          : null;
    }
  });
  measurementStartObservers.forEach((observer) => observer());

  settleCheckpointTimer = setTimeout(() => {
    const activeMeasurement = measurement;
    if (!activeMeasurement || activeMeasurement.startedAt !== startedAt) {
      return;
    }

    captureTimingEvent(activeMeasurement, 'checkpoint');
  }, CHATLIST_IN_FLIGHT_CHECKPOINT_MS);
}

export function observeChatListMeasurementStart(observer: () => void) {
  measurementStartObservers.add(observer);
  return () => {
    measurementStartObservers.delete(observer);
  };
}

export function markChatListSyncSinceComplete(
  result: SyncSinceResult,
  durationMs: number,
  hadChanges: boolean | null = null,
  nodeBusyStatus: string | null = null,
  postsCount: number | null = null,
  neededToSyncLatestPosts = false,
  unreadTargets: {
    channelUnreadCounts: Record<string, number>;
    groupUnreadCounts: Record<string, number>;
  } | null = null
) {
  const activeMeasurement = measurement;
  if (
    !activeMeasurement ||
    activeMeasurement.requiredSyncSource !== 'syncSince'
  ) {
    return;
  }

  activeMeasurement.syncCompleted = true;
  activeMeasurement.syncResult = result;
  activeMeasurement.syncDurationMs = durationMs;
  activeMeasurement.syncNodeBusyStatus = nodeBusyStatus;
  activeMeasurement.syncPostsCount = postsCount;
  activeMeasurement.neededToSyncLatestPosts = neededToSyncLatestPosts;
  activeMeasurement.syncHadChanges = hadChanges;
  activeMeasurement.syncUnreadTargets = unreadTargets;
  activeMeasurement.syncUnreadTargetsMatched = unreadTargets
    ? areUnreadTargetsEmpty(unreadTargets)
    : null;
  activeMeasurement.syncCompletedAtMs = Date.now();

  if (maybeEmitSettled(activeMeasurement, 'sync_render_match')) {
    return;
  }
  queueSettleIfReady(activeMeasurement.startedAt);
}

export function reportChatListSnapshot(chats: db.GroupedChats) {
  lastChats = chats;
  const activeMeasurement = measurement;
  if (!activeMeasurement) {
    return;
  }

  const signature = buildChatSettleSignature(chats);
  if (
    activeMeasurement.syncCompletedAtMs &&
    Date.now() >= activeMeasurement.syncCompletedAtMs
  ) {
    activeMeasurement.postSyncSnapshotSeen = true;
    if (activeMeasurement.syncUnreadTargets) {
      activeMeasurement.syncUnreadTargetsMatched = doChatsMatchUnreadTargets(
        chats,
        activeMeasurement.syncUnreadTargets
      );
    }
    if (activeMeasurement.cacheUnreadTargets) {
      activeMeasurement.cacheUnreadTargetsMatched = doChatsMatchUnreadTargets(
        chats,
        activeMeasurement.cacheUnreadTargets
      );
      if (
        activeMeasurement.cacheUnreadTargetsMatched &&
        !activeMeasurement.cacheDataMatchedAtMs
      ) {
        activeMeasurement.cacheDataMatchedAtMs = Date.now();
      }
      if (
        activeMeasurement.cacheUnreadTargetsMatched &&
        activeMeasurement.lastRenderedSignature === signature &&
        !activeMeasurement.cacheRenderedAtMs
      ) {
        activeMeasurement.cacheRenderedAtMs = Date.now();
        activeMeasurement.cacheRenderedSignature = signature;
      }
    }
  }
  if (signature === activeMeasurement.lastSignature) {
    return;
  }

  if (activeMeasurement.lastSignature === null) {
    activeMeasurement.lastSignature = signature;
    if (maybeEmitSettled(activeMeasurement, 'sync_render_match')) {
      return;
    }
    queueSettleIfReady(activeMeasurement.startedAt);
    return;
  }

  activeMeasurement.lastSignature = signature;
  activeMeasurement.changeCount += 1;
  if (maybeEmitSettled(activeMeasurement, 'sync_render_match')) {
    return;
  }
  queueSettleIfReady(activeMeasurement.startedAt);
}

export function reportChatListFirstPaint() {
  const activeMeasurement = measurement;
  if (!activeMeasurement || activeMeasurement.firstPaintDurationMs !== null) {
    return;
  }

  activeMeasurement.firstPaintDurationMs =
    Date.now() - activeMeasurement.startedAt;
}

export function reportChatListRendered(signature: string) {
  const activeMeasurement = measurement;
  if (!activeMeasurement) {
    return;
  }

  activeMeasurement.lastRenderedSignature = signature;
  activeMeasurement.lastRenderAtMs = Date.now();
  if (!activeMeasurement.firstRenderedAtBySignature[signature]) {
    activeMeasurement.firstRenderedAtBySignature[signature] =
      activeMeasurement.lastRenderAtMs;
  }
  if (
    activeMeasurement.cacheUnreadTargetsMatched &&
    activeMeasurement.lastSignature === signature &&
    !activeMeasurement.cacheRenderedAtMs
  ) {
    activeMeasurement.cacheRenderedAtMs = activeMeasurement.lastRenderAtMs;
    activeMeasurement.cacheRenderedSignature = signature;
  }
  if (maybeEmitSettled(activeMeasurement, 'sync_render_match')) {
    return;
  }
  if (
    activeMeasurement.waitingForSettledRender &&
    activeMeasurement.settledSignature &&
    activeMeasurement.settledSignature === signature
  ) {
    activeMeasurement.latestDataPaintAtMs =
      activeMeasurement.firstRenderedAtBySignature[signature] ??
      activeMeasurement.lastRenderAtMs;
    captureTimingEvent(activeMeasurement, 'settled', 'idle_window');
    stopSettleMeasurement();
  }
}

export function reportChatListNativeCacheResult({
  present,
  applied,
  readMs,
  parseMs,
  insertMs,
  totalMs,
  unreadTargets,
}: {
  present: boolean;
  applied: boolean;
  readMs?: number | null;
  parseMs?: number | null;
  insertMs?: number | null;
  totalMs?: number | null;
  unreadTargets?: {
    channelUnreadCounts: Record<string, number>;
    groupUnreadCounts: Record<string, number>;
  } | null;
}) {
  const activeMeasurement = measurement;
  if (!activeMeasurement) {
    return;
  }

  activeMeasurement.nativeCacheChecked = true;
  activeMeasurement.nativeCachePresent = present;
  activeMeasurement.nativeCacheApplied = applied;
  activeMeasurement.nativeCacheReadMs = readMs ?? null;
  activeMeasurement.nativeCacheParseMs = parseMs ?? null;
  activeMeasurement.nativeCacheInsertMs = insertMs ?? null;
  activeMeasurement.nativeCacheTotalMs = totalMs ?? null;
  activeMeasurement.cacheUnreadTargets = applied ? unreadTargets ?? null : null;
  activeMeasurement.cacheUnreadTargetsMatched = null;
}

export function markChatListMeasurementAbandoned(
  reason: 'inactive' | 'background'
) {
  const activeMeasurement = measurement;
  if (!activeMeasurement) {
    return false;
  }

  captureTimingEvent(activeMeasurement, 'abandoned', null, reason);
  stopSettleMeasurement();
  return true;
}

function doChatsMatchUnreadTargets(
  chats: db.GroupedChats,
  targets: {
    channelUnreadCounts: Record<string, number>;
    groupUnreadCounts: Record<string, number>;
  }
) {
  const channelUnreadMap = new Map<string, number>();
  const groupUnreadMap = new Map<string, number>();
  [...chats.pinned, ...chats.pending, ...chats.unpinned].forEach((chat) => {
    if (chat.type === 'channel') {
      channelUnreadMap.set(chat.id, chat.unreadCount ?? 0);
    } else {
      groupUnreadMap.set(chat.id, chat.unreadCount ?? 0);
    }
  });

  for (const [channelId, unreadCount] of Object.entries(
    targets.channelUnreadCounts
  )) {
    if ((channelUnreadMap.get(channelId) ?? null) !== unreadCount) {
      return false;
    }
  }

  for (const [groupId, unreadCount] of Object.entries(
    targets.groupUnreadCounts
  )) {
    if ((groupUnreadMap.get(groupId) ?? null) !== unreadCount) {
      return false;
    }
  }

  return true;
}

function areUnreadTargetsEmpty(targets: {
  channelUnreadCounts: Record<string, number>;
  groupUnreadCounts: Record<string, number>;
}) {
  return (
    Object.keys(targets.channelUnreadCounts).length === 0 &&
    Object.keys(targets.groupUnreadCounts).length === 0
  );
}

function getSyncUnreadSectionTopItemMatch(
  chats: db.GroupedChats | null,
  targets: {
    channelUnreadCounts: Record<string, number>;
    groupUnreadCounts: Record<string, number>;
  } | null,
  section: 'pinned' | 'unpinned'
): boolean | null {
  if (!targets) {
    return null;
  }
  const sectionItems = chats
    ? section === 'pinned'
      ? chats.pinned
      : chats.unpinned
    : [];
  if (!sectionItems.length) {
    return null;
  }

  const hasTargetInSection = sectionItems.some((item) =>
    item.type === 'channel'
      ? typeof targets.channelUnreadCounts[item.id] === 'number'
      : typeof targets.groupUnreadCounts[item.id] === 'number'
  );
  if (!hasTargetInSection) {
    return null;
  }

  const topItem = sectionItems[0];
  if (!topItem) {
    return null;
  }

  if (topItem.type === 'channel') {
    const target = targets.channelUnreadCounts[topItem.id];
    if (typeof target !== 'number') {
      return false;
    }
    return (topItem.unreadCount ?? 0) === target;
  }

  const target = targets.groupUnreadCounts[topItem.id];
  if (typeof target !== 'number') {
    return false;
  }
  return (topItem.unreadCount ?? 0) === target;
}

function getAnySectionTopItemMatch(
  pinnedMatch: boolean | null,
  unpinnedMatch: boolean | null
): boolean | null {
  const checks = [pinnedMatch, unpinnedMatch].filter(
    (value): value is boolean => value !== null
  );
  if (!checks.length) {
    return null;
  }
  return checks.every((value) => value === true);
}
