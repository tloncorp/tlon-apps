import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';

const logger = createDevLogger('PushNotifTapTelemetry', false);
const PUSH_NOTIF_TIMING_EVENT = 'Push Notif Open Timing';
const PUSH_NOTIF_CHECKPOINT_MS = 5000;
const RENDERED_POST_ID_LIMIT = 120;

type SyncSinceResult = 'success' | 'error';

type PushNotifMeasurement = {
  channelId: string;
  startedAt: number;
  notificationReceivedAtMs: number | null;
  initialLastPostId: string | null;
  nativeCacheChecked: boolean;
  nativeCachePresent: boolean;
  nativeCacheApplied: boolean;
  nativeCacheTotalMs: number | null;
  notificationSyncCompleted: boolean | null;
  cachedPostsRelatedToChannel: boolean | null;
  cachedHadGroundTruthLatestPost: boolean | null;
  cachedChannelLatestPostId: string | null;
  cacheRenderedAtMs: number | null;
  syncRequestCompleted: boolean;
  syncResult: SyncSinceResult | null;
  syncDurationMs: number | null;
  syncNodeBusyStatus: string | null;
  syncPostsCount: number | null;
  neededToSyncLatestPosts: boolean;
  syncFoundNewerMessage: boolean | null;
  latestPostIdAfterSync: string | null;
  latestMessageCachedAtTap: boolean | null;
  latestMessagePaintAtMs: number | null;
  newestMessageShown: boolean | null;
  newestMessageShownAtMs: number | null;
  lastRenderedPostIds: string[];
  firstRenderedAtByPostId: Record<string, number>;
};

type NativeCacheContext = {
  checked: boolean;
  present: boolean;
  applied: boolean;
  totalMs: number | null;
  notificationReceivedAtMs: number | null;
  notificationSyncCompleted: boolean | null;
  cachedChannelIds: Set<string>;
  cachedLatestPostByChannelId: Record<string, string>;
};

let measurement: PushNotifMeasurement | null = null;
let checkpointTimer: ReturnType<typeof setTimeout> | null = null;
let latestNativeCacheContext: NativeCacheContext = {
  checked: false,
  present: false,
  applied: false,
  totalMs: null,
  notificationReceivedAtMs: null,
  notificationSyncCompleted: null,
  cachedChannelIds: new Set<string>(),
  cachedLatestPostByChannelId: {},
};

function stopMeasurement() {
  if (checkpointTimer) {
    clearTimeout(checkpointTimer);
    checkpointTimer = null;
  }
  measurement = null;
}

function captureEvent(
  current: PushNotifMeasurement,
  outcome: 'settled' | 'checkpoint' | 'abandoned',
  abandonedReason: 'inactive' | 'background' | null = null
) {
  logger.trackEvent(PUSH_NOTIF_TIMING_EVENT, {
    outcome,
    abandonedReason,
    channelId: current.channelId,
    durationMs: Date.now() - current.startedAt,
    notifToTapDurationMs:
      current.notificationReceivedAtMs !== null
        ? current.startedAt - current.notificationReceivedAtMs
        : null,
    nativeCacheChecked: current.nativeCacheChecked,
    nativeCachePresent: current.nativeCachePresent,
    nativeCacheApplied: current.nativeCacheApplied,
    nativeCacheTotalMs: current.nativeCacheTotalMs,
    notificationSyncCompleted: current.notificationSyncCompleted,
    cachedPostsRelatedToChannel: current.cachedPostsRelatedToChannel,
    cachedHadGroundTruthLatestPost: current.cachedHadGroundTruthLatestPost,
    cacheRenderDurationMs: current.cacheRenderedAtMs
      ? current.cacheRenderedAtMs - current.startedAt
      : null,
    syncRequestCompleted: current.syncRequestCompleted,
    syncResult: current.syncResult,
    syncDurationMs: current.syncDurationMs,
    nodeBusyStatus: current.syncNodeBusyStatus,
    syncPostsCount: current.syncPostsCount,
    neededToSyncLatestPosts: current.neededToSyncLatestPosts,
    syncFoundNewerMessage: current.syncFoundNewerMessage,
    latestMessageCachedAtTap: current.latestMessageCachedAtTap,
    latestMessagePaintDurationMs: current.latestMessagePaintAtMs
      ? current.latestMessagePaintAtMs - current.startedAt
      : null,
    latestMessageConfirmedDurationMs: current.newestMessageShownAtMs
      ? current.newestMessageShownAtMs - current.startedAt
      : null,
    newestMessageShown: current.newestMessageShown,
    newestMessageShownDurationMs: current.newestMessageShownAtMs
      ? current.newestMessageShownAtMs - current.startedAt
      : null,
  });
}

function updateLatestMessagePaint(current: PushNotifMeasurement) {
  if (!current.latestPostIdAfterSync) {
    return;
  }
  const firstRenderedAt =
    current.firstRenderedAtByPostId[current.latestPostIdAfterSync];
  if (firstRenderedAt && !current.latestMessagePaintAtMs) {
    current.latestMessagePaintAtMs = firstRenderedAt;
  }
}

function updateNewestMessageShown(current: PushNotifMeasurement) {
  if (!current.syncRequestCompleted) {
    return;
  }

  if (!current.latestPostIdAfterSync) {
    current.newestMessageShown = true;
    if (!current.newestMessageShownAtMs) {
      current.newestMessageShownAtMs = Date.now();
    }
    return;
  }

  const shown = current.lastRenderedPostIds.includes(current.latestPostIdAfterSync);
  current.newestMessageShown = shown;
  if (shown && !current.newestMessageShownAtMs) {
    current.newestMessageShownAtMs = Date.now();
  }
}

function maybeEmitSettled(current: PushNotifMeasurement) {
  if (!current.syncRequestCompleted) {
    return false;
  }
  if (current.newestMessageShown !== true) {
    return false;
  }
  captureEvent(current, 'settled');
  stopMeasurement();
  return true;
}

function applyNativeCacheContextToMeasurement(
  current: PushNotifMeasurement,
  context: NativeCacheContext
) {
  current.nativeCacheChecked = context.checked;
  current.nativeCachePresent = context.present;
  current.nativeCacheApplied = context.applied;
  current.nativeCacheTotalMs = context.totalMs;
  current.notificationReceivedAtMs = context.notificationReceivedAtMs;
  current.notificationSyncCompleted = context.notificationSyncCompleted;
  current.cachedPostsRelatedToChannel = context.cachedChannelIds.has(
    current.channelId
  );
  current.cachedChannelLatestPostId =
    context.cachedLatestPostByChannelId[current.channelId] ?? null;
}

export function startPushNotifTapMeasurement({
  channelId,
  initialLastPostId,
}: {
  channelId: string;
  initialLastPostId: string | null;
}) {
  stopMeasurement();
  const startedAt = Date.now();
  measurement = {
    channelId,
    startedAt,
    notificationReceivedAtMs: null,
    initialLastPostId,
    nativeCacheChecked: false,
    nativeCachePresent: false,
    nativeCacheApplied: false,
    nativeCacheTotalMs: null,
    notificationSyncCompleted: null,
    cachedPostsRelatedToChannel: null,
    cachedHadGroundTruthLatestPost: null,
    cachedChannelLatestPostId: null,
    cacheRenderedAtMs: null,
    syncRequestCompleted: false,
    syncResult: null,
    syncDurationMs: null,
    syncNodeBusyStatus: null,
    syncPostsCount: null,
    neededToSyncLatestPosts: false,
    syncFoundNewerMessage: null,
    latestPostIdAfterSync: null,
    latestMessageCachedAtTap: null,
    latestMessagePaintAtMs: null,
    newestMessageShown: null,
    newestMessageShownAtMs: null,
    lastRenderedPostIds: [],
    firstRenderedAtByPostId: {},
  };
  applyNativeCacheContextToMeasurement(measurement, latestNativeCacheContext);

  checkpointTimer = setTimeout(() => {
    const active = measurement;
    if (!active || active.startedAt !== startedAt) {
      return;
    }
    captureEvent(active, 'checkpoint');
  }, PUSH_NOTIF_CHECKPOINT_MS);
}

export async function markPushNotifTapSyncSinceComplete(
  result: SyncSinceResult,
  durationMs: number,
  nodeBusyStatus: string | null = null,
  postsCount: number | null = null,
  neededToSyncLatestPosts = false
) {
  const current = measurement;
  if (!current) {
    return;
  }

  current.syncRequestCompleted = true;
  current.syncResult = result;
  current.syncDurationMs = durationMs;
  current.syncNodeBusyStatus = nodeBusyStatus;
  current.syncPostsCount = postsCount;
  current.neededToSyncLatestPosts = neededToSyncLatestPosts;

  if (result !== 'success') {
    current.latestPostIdAfterSync = current.initialLastPostId;
    current.syncFoundNewerMessage = false;
    current.latestMessageCachedAtTap = null;
    updateNewestMessageShown(current);
    maybeEmitSettled(current);
    return;
  }

  const channel = await db.getChannelWithRelations({ id: current.channelId });
  const syncedLastPostId = channel?.lastPostId ?? null;
  current.latestPostIdAfterSync = syncedLastPostId;
  current.syncFoundNewerMessage =
    current.initialLastPostId !== syncedLastPostId &&
    syncedLastPostId !== null;
  current.latestMessageCachedAtTap =
    current.initialLastPostId === syncedLastPostId;
  current.cachedHadGroundTruthLatestPost =
    current.cachedPostsRelatedToChannel && syncedLastPostId !== null
      ? current.cachedChannelLatestPostId === syncedLastPostId
      : null;
  updateLatestMessagePaint(current);
  updateNewestMessageShown(current);
  maybeEmitSettled(current);
}

export function reportPushNotifChannelRendered(
  channelId: string,
  renderedPostIds: string[]
) {
  const current = measurement;
  if (!current || current.channelId !== channelId) {
    return;
  }

  current.lastRenderedPostIds = renderedPostIds.slice(0, RENDERED_POST_ID_LIMIT);
  const renderedAtMs = Date.now();
  current.lastRenderedPostIds.forEach((postId) => {
    if (!current.firstRenderedAtByPostId[postId]) {
      current.firstRenderedAtByPostId[postId] = renderedAtMs;
    }
  });
  if (
    current.cachedPostsRelatedToChannel &&
    !current.cacheRenderedAtMs &&
    (current.cachedChannelLatestPostId
      ? current.lastRenderedPostIds.includes(current.cachedChannelLatestPostId)
      : current.lastRenderedPostIds.length > 0)
  ) {
    current.cacheRenderedAtMs = renderedAtMs;
  }
  updateLatestMessagePaint(current);
  updateNewestMessageShown(current);
  maybeEmitSettled(current);
}

export function markPushNotifTapMeasurementAbandoned(
  reason: 'inactive' | 'background'
) {
  const current = measurement;
  if (!current) {
    return false;
  }
  captureEvent(current, 'abandoned', reason);
  stopMeasurement();
  return true;
}

export function reportPushNotifNativeCacheResult({
  checked,
  present,
  applied,
  totalMs,
  notificationReceivedAtMs,
  notificationSyncCompleted,
  cachedChannelIds,
  cachedLatestPostByChannelId,
}: {
  checked: boolean;
  present: boolean;
  applied: boolean;
  totalMs?: number | null;
  notificationReceivedAtMs?: number | null;
  notificationSyncCompleted?: boolean | null;
  cachedChannelIds?: string[];
  cachedLatestPostByChannelId?: Record<string, string>;
}) {
  latestNativeCacheContext = {
    checked,
    present,
    applied,
    totalMs: totalMs ?? null,
    notificationReceivedAtMs: notificationReceivedAtMs ?? null,
    notificationSyncCompleted: notificationSyncCompleted ?? null,
    cachedChannelIds: new Set(cachedChannelIds ?? []),
    cachedLatestPostByChannelId: cachedLatestPostByChannelId ?? {},
  };

  if (measurement) {
    applyNativeCacheContextToMeasurement(measurement, latestNativeCacheContext);
  }
}
