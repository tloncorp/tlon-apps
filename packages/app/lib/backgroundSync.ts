import { createDevLogger, syncStart } from '@tloncorp/shared';
import { storage } from '@tloncorp/shared/db';
import * as db from '@tloncorp/shared/db';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { configureUrbitClient } from '../hooks/useConfigureUrbitClient';

const logger = createDevLogger('backgroundSync', true);

function summarizePost(post: db.Post) {
  return {
    channel: post.channelId,
    content: post.content,
    syncedAt: post.syncedAt,
  };
}

async function performSync() {
  const shipInfo = await storage.shipInfo.getValue();
  if (shipInfo == null) {
    logger.info('No ship info found, skipping sync');
    return;
  }

  if (
    shipInfo.ship == null ||
    shipInfo.shipUrl == null ||
    shipInfo.authType == null
  ) {
    logger.info('Ship info missing necessary fields');
    return;
  }

  logger.trackEvent('Performing Background Sync');

  logger.log('Configuring urbit client...');
  configureUrbitClient({
    ship: shipInfo.ship,
    shipUrl: shipInfo.shipUrl,
    authType: shipInfo.authType,
  });
  logger.log('Configured urbit client.');

  logger.log('Starting background sync...');
  await syncStart(
    // we pass alreadySubscribed=true to avoid making subscriptions
    true
  );
  logger.log('Completed background sync.');
}

const TASK_ID = 'backgroundSync';
export async function unregisterBackgroundSyncTask() {
  await Notifications.unregisterTaskAsync(TASK_ID);
  await BackgroundFetch.unregisterTaskAsync(TASK_ID);
  await TaskManager.unregisterTaskAsync(TASK_ID);
}
export function registerBackgroundSyncTask() {
  TaskManager.defineTask<Record<string, unknown>>(
    TASK_ID,
    async ({ error }): Promise<BackgroundFetch.BackgroundFetchResult> => {
      logger.log(`Running background sync background task`);
      if (error) {
        logger.error(`Failed background sync background task`, error.message);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }

      try {
        await performSync();
        // We always return NewData because we don't have a way to know whether
        // there actually was new data.
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (err) {
        logger.error(
          'Failed background sync',
          err instanceof Error ? err.message : err
        );
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    }
  );

  logger.log('Registered background sync task');
  (async () => {
    try {
      await Notifications.registerTaskAsync(TASK_ID);
      logger.log('Registered notification task');
      await BackgroundFetch.registerTaskAsync(TASK_ID, {
        // Uses expo-notification default - at time of writing, 10 minutes on
        // Android, system minimum on iOS (10-15 minutes)
        // minimumInterval: undefined,

        // Android-only
        // We could flip these to be more aggressive; let's start with lower
        // usage to avoid slamming battery.
        stopOnTerminate: true,
        startOnBoot: false,
      });
      logger.log('Registered background fetch');
    } catch (err) {
      logger.error('Failed to register background sync task', err);
    }
  })();
}
