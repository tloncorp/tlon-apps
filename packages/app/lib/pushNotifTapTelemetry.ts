import { fetch as fetchNetInfo } from '@react-native-community/netinfo';
import { createDevLogger } from '@tloncorp/shared';
import { getChannelPosts } from '@tloncorp/api';

const logger = createDevLogger('PushNotifTapTelemetry', false);
const PUSH_TAP_CHECK_EVENT = 'Push Tap Correctness Check';
const DEADLINE_MS = 5000;


type PushNotifMeasurement = {
  channelId: string;
  startedAt: number;
  serverNewestPostId: string | null;
  serverNewestSequenceNum: number | null;
  serverFetchCompleted: boolean;
  lastRenderedPostIds: string[];
  firstPaintedAtMs: number | null;
  networkType: string | null;
  networkConnected: boolean | null;
  networkInternetReachable: boolean | null;
  cellularGeneration: string | null;
  // useChannelPosts render context
  renderedNewestSequenceNum: number | null;
  renderedOldestSequenceNum: number | null;
  cursorSequenceNum: number | null;
  channelMode: string | null;
  // syncSince context for debugging failures
  syncSinceResult: string | null;
  syncSinceDurationMs: number | null;
  syncSinceNodeBusyStatus: string | null;
  syncSincePostsCount: number | null;
  syncSinceNeededLatestPosts: boolean | null;
};

let measurement: PushNotifMeasurement | null = null;
let deadlineTimer: ReturnType<typeof setTimeout> | null = null;

function stopMeasurement() {
  if (deadlineTimer) {
    clearTimeout(deadlineTimer);
    deadlineTimer = null;
  }
  measurement = null;
}

function captureEvent(
  current: PushNotifMeasurement,
  outcome: 'success' | 'fail',
  failureReason: string | null = null
) {
  const serverNewestPostDisplayed =
    current.serverNewestPostId != null
      ? current.lastRenderedPostIds.includes(current.serverNewestPostId)
      : null;

  logger.trackEvent(PUSH_TAP_CHECK_EVENT, {
    outcome,
    failureReason,
    channelId: current.channelId,
    durationMs: Date.now() - current.startedAt,
    serverFetchCompleted: current.serverFetchCompleted,
    serverNewestPostId: current.serverNewestPostId,
    serverNewestSequenceNum: current.serverNewestSequenceNum,
    serverNewestPostDisplayed,
    firstPaintedAtMs: current.firstPaintedAtMs
      ? current.firstPaintedAtMs - current.startedAt
      : null,
    networkType: current.networkType,
    networkConnected: current.networkConnected,
    networkInternetReachable: current.networkInternetReachable,
    cellularGeneration: current.cellularGeneration,
    renderedNewestSequenceNum: current.renderedNewestSequenceNum,
    renderedOldestSequenceNum: current.renderedOldestSequenceNum,
    cursorSequenceNum: current.cursorSequenceNum,
    channelMode: current.channelMode,
    syncSinceResult: current.syncSinceResult,
    syncSinceDurationMs: current.syncSinceDurationMs,
    syncSinceNodeBusyStatus: current.syncSinceNodeBusyStatus,
    syncSincePostsCount: current.syncSincePostsCount,
    syncSinceNeededLatestPosts: current.syncSinceNeededLatestPosts,
  });
}

function maybeEmitSuccess(current: PushNotifMeasurement) {
  if (!current.serverFetchCompleted || current.serverNewestPostId == null) {
    return false;
  }
  if (!current.lastRenderedPostIds.includes(current.serverNewestPostId)) {
    return false;
  }
  if (!current.firstPaintedAtMs) {
    current.firstPaintedAtMs = Date.now();
  }
  captureEvent(current, 'success');
  stopMeasurement();
  return true;
}

export function startPushNotifTapMeasurement({
  channelId,
}: {
  channelId: string;
  initialLastPostId: string | null;
}) {
  stopMeasurement();
  const startedAt = Date.now();
  measurement = {
    channelId,
    startedAt,
    serverNewestPostId: null,
    serverNewestSequenceNum: null,
    serverFetchCompleted: false,
    lastRenderedPostIds: [],
    firstPaintedAtMs: null,
    networkType: null,
    networkConnected: null,
    networkInternetReachable: null,
    cellularGeneration: null,
    renderedNewestSequenceNum: null,
    renderedOldestSequenceNum: null,
    cursorSequenceNum: null,
    channelMode: null,
    syncSinceResult: null,
    syncSinceDurationMs: null,
    syncSinceNodeBusyStatus: null,
    syncSincePostsCount: null,
    syncSinceNeededLatestPosts: null,
  };

  getChannelPosts({ channelId, mode: 'newest', count: 1 })
    .then((response) => {
      if (measurement && measurement.startedAt === startedAt) {
        measurement.serverNewestPostId = response.posts[0]?.id ?? null;
        measurement.serverNewestSequenceNum =
          response.newestSequenceNum ?? null;
        measurement.serverFetchCompleted = true;
        maybeEmitSuccess(measurement);
      }
    })
    .catch(() => {
      if (measurement && measurement.startedAt === startedAt) {
        measurement.serverFetchCompleted = true;
      }
    });

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

  deadlineTimer = setTimeout(() => {
    const active = measurement;
    if (!active || active.startedAt !== startedAt) {
      return;
    }
    const reason = !active.serverFetchCompleted
      ? 'server fetch incomplete at deadline'
      : active.serverNewestPostId == null
        ? 'server returned no posts'
        : 'newest post not rendered at deadline';
    captureEvent(active, 'fail', reason);
    stopMeasurement();
  }, DEADLINE_MS);
}

export function reportPushNotifChannelRendered(
  channelId: string,
  renderedPostIds: string[],
  renderContext?: {
    newestSequenceNum: number | null;
    oldestSequenceNum: number | null;
    cursorSequenceNum: number | null;
    channelMode: string | null;
  }
) {
  const current = measurement;
  if (!current || current.channelId !== channelId) {
    return;
  }

  current.lastRenderedPostIds = renderedPostIds;
  if (renderContext) {
    current.renderedNewestSequenceNum = renderContext.newestSequenceNum;
    current.renderedOldestSequenceNum = renderContext.oldestSequenceNum;
    current.cursorSequenceNum = renderContext.cursorSequenceNum;
    current.channelMode = renderContext.channelMode;
  }
  maybeEmitSuccess(current);
}

export function reportPushNotifChannelUnfocused(channelId: string) {
  const current = measurement;
  if (!current || current.channelId !== channelId) {
    return;
  }
  captureEvent(current, 'fail', 'navigated away before newest post displayed');
  stopMeasurement();
}

// Stubs for callers that haven't been cleaned up yet
export function markPushNotifTapMeasurementAbandoned(
  _reason: 'inactive' | 'background'
) {
  return false;
}

export function markPushNotifTapSyncSinceComplete(
  result: 'success' | 'error',
  durationMs: number,
  nodeBusyStatus: string | null = null,
  postsCount: number | null = null,
  neededToSyncLatestPosts = false
) {
  const current = measurement;
  if (!current) {
    return;
  }
  current.syncSinceResult = result;
  current.syncSinceDurationMs = durationMs;
  current.syncSinceNodeBusyStatus = nodeBusyStatus;
  current.syncSincePostsCount = postsCount;
  current.syncSinceNeededLatestPosts = neededToSyncLatestPosts;
}

export function reportPushNotifNativeCacheResult(_params: {
  checked: boolean;
  present: boolean;
  applied: boolean;
  totalMs?: number | null;
  notificationReceivedAtMs?: number | null;
  notificationSyncCompleted?: boolean | null;
  cachedChannelIds?: string[];
  cachedLatestPostByChannelId?: Record<string, string>;
}) {}
