import { createDevLogger } from '@tloncorp/shared';
import * as api from '@tloncorp/api';
import {
  CHANGES_SYNCED_AT_KEY,
  registerStorageItemListener,
} from '@tloncorp/shared/db';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as utils from '@tloncorp/shared/utils';
import { reportChatListNativeCacheResult } from '@tloncorp/app/lib/chatListSettleTelemetry';
import { reportPushNotifNativeCacheResult } from '@tloncorp/app/lib/pushNotifTapTelemetry';
import { useCallback, useEffect } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

export interface BackgroundCacheSpec {
  setLastSyncTimestamp(timestamp: number): Promise<void>;
  retrieveBackgroundData(): Promise<string | null>;
}

const BackgroundCache = TurboModuleRegistry.get(
  'BackgroundCache'
) as BackgroundCacheSpec | null;
const ENABLED = Platform.OS === 'ios' && BackgroundCache;

const logger = createDevLogger('cachedChanges', true);

export function useCachedChanges() {
  // scaffold a listener to propagate changes to our synced at stamp
  useEffect(() => {
    if (ENABLED) {
      registerStorageItemListener<number | null>(
        CHANGES_SYNCED_AT_KEY,
        async (newStamp) => {
          try {
            logger.log('changes sync stamp updated, sending to native module');
            await BackgroundCache.setLastSyncTimestamp(newStamp ?? 0);
          } catch (e) {
            logger.trackError(
              `Failed to send last sync timetamp to native module`,
              e
            );
          }
        }
      );
    }
  }, []);

  const checkForCachedChanges = useCallback(async () => {
    if (!ENABLED) {
      reportChatListNativeCacheResult({
        present: false,
        applied: false,
      });
      reportPushNotifNativeCacheResult({
        checked: false,
        present: false,
        applied: false,
      });
      return;
    }
    const execStart = Date.now();

    logger.log(`checking for cached changes...`);

    let cacheResult = null;
    try {
      cacheResult = await BackgroundCache.retrieveBackgroundData();
    } catch (e) {
      logger.trackError(`Failed to retrieve background data`, e);
      reportChatListNativeCacheResult({
        present: false,
        applied: false,
      });
      reportPushNotifNativeCacheResult({
        checked: true,
        present: false,
        applied: false,
      });
    }
    if (!cacheResult) {
      reportChatListNativeCacheResult({
        present: false,
        applied: false,
      });
      reportPushNotifNativeCacheResult({
        checked: true,
        present: false,
        applied: false,
      });
      return;
    }

    const readAt = Date.now();
    logger.log(`cached changes present`);

    let changes: db.ChangesResult | null = null;
    let begin, end;
    let notificationReceivedAtMs: number | null = null;
    let notificationSyncCompleted: boolean | null = null;
    try {
      const deserialized = JSON.parse(cacheResult);
      changes = api.parseChanges(deserialized.changes);
      begin = Number(deserialized.beginTimestamp);
      end = Number(deserialized.endTimestamp);
      const rawNotificationReceivedAtMs = Number(
        deserialized.notificationReceivedAtMs
      );
      notificationReceivedAtMs = Number.isFinite(rawNotificationReceivedAtMs)
        ? rawNotificationReceivedAtMs
        : null;
      notificationSyncCompleted =
        typeof deserialized.notificationSyncCompleted === 'boolean'
          ? deserialized.notificationSyncCompleted
          : null;
      logger.log(`cached changes result`, { begin, end, changes });
    } catch (e) {
      logger.trackEvent('Failed to parse cached changes');
      reportChatListNativeCacheResult({
        present: true,
        applied: false,
        readMs: readAt - execStart,
        parseMs: Date.now() - readAt,
        insertMs: null,
        totalMs: Date.now() - execStart,
      });
      reportPushNotifNativeCacheResult({
        checked: true,
        present: true,
        applied: false,
        totalMs: Date.now() - execStart,
        notificationReceivedAtMs,
        notificationSyncCompleted,
      });
    }
    const parsedAt = Date.now();

    if (changes && begin && end) {
      try {
        logger.log(`Retrieved cached changes ${begin} - ${end}, syncing...`);
        const didInsert = await store.syncCachedChanges({
          changes,
          begin,
          end,
        });
        const channelUnreadCounts = Object.fromEntries(
          changes.unreads.channelUnreads.map((u) => [u.channelId, u.count ?? 0])
        );
        const groupUnreadCounts = Object.fromEntries(
          changes.unreads.groupUnreads.map((u) => [u.groupId, u.count ?? 0])
        );
        const cachedChannelIds = new Set<string>();
        const cachedLatestPostByChannelId: Record<string, string> = {};
        const cachedLatestSequenceByChannelId: Record<string, number> = {};
        changes.posts.forEach((post) => {
          const channelId = post.channelId;
          if (!channelId) {
            return;
          }
          cachedChannelIds.add(channelId);
          const sequenceNum =
            typeof post.sequenceNum === 'number' ? post.sequenceNum : -1;
          const prevSequence = cachedLatestSequenceByChannelId[channelId] ?? -1;
          if (
            sequenceNum > prevSequence ||
            cachedLatestPostByChannelId[channelId] === undefined
          ) {
            cachedLatestSequenceByChannelId[channelId] = sequenceNum;
            cachedLatestPostByChannelId[channelId] = post.id;
          }
        });
        reportChatListNativeCacheResult({
          present: true,
          applied: didInsert,
          readMs: readAt - execStart,
          parseMs: parsedAt - readAt,
          insertMs: Date.now() - parsedAt,
          totalMs: Date.now() - execStart,
          unreadTargets: {
            channelUnreadCounts,
            groupUnreadCounts,
          },
        });
        reportPushNotifNativeCacheResult({
          checked: true,
          present: true,
          applied: didInsert,
          totalMs: Date.now() - execStart,
          notificationReceivedAtMs,
          notificationSyncCompleted,
          cachedChannelIds: Array.from(cachedChannelIds),
          cachedLatestPostByChannelId,
        });
        logger.log(`Synced cache changes: ${Date.now() - execStart}ms`);
        logger.trackEvent('Synced cached changes', {
          begin,
          end,
          numPosts: changes.posts.length,
          numGroups: changes.groups.length,
          windowSize: utils.formattedDuration(begin, end),
          duration: utils.formattedDuration(execStart, Date.now()),
          didInsert,
          timeToRead: utils.formattedDuration(execStart, readAt),
          timeToParse: utils.formattedDuration(readAt, parsedAt),
          timeToInsert: utils.formattedDuration(parsedAt, Date.now()),
        });
      } catch (e) {
        reportChatListNativeCacheResult({
          present: true,
          applied: false,
          readMs: readAt - execStart,
          parseMs: parsedAt - readAt,
          insertMs: null,
          totalMs: Date.now() - execStart,
        });
        reportPushNotifNativeCacheResult({
          checked: true,
          present: true,
          applied: false,
          totalMs: Date.now() - execStart,
          notificationReceivedAtMs,
          notificationSyncCompleted,
        });
        logger.trackError(`Failed to sync cached changes`, e);
      }
    } else {
      reportChatListNativeCacheResult({
        present: true,
        applied: false,
        readMs: readAt - execStart,
        parseMs: parsedAt - readAt,
        insertMs: null,
        totalMs: Date.now() - execStart,
      });
      reportPushNotifNativeCacheResult({
        checked: true,
        present: true,
        applied: false,
        totalMs: Date.now() - execStart,
        notificationReceivedAtMs,
        notificationSyncCompleted,
      });
    }
  }, []);

  return checkForCachedChanges;
}
