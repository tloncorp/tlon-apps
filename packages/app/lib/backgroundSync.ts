import {
  createDevLogger,
  syncLatestPosts,
  syncUnreads,
} from '@tloncorp/shared';
import { storage } from '@tloncorp/shared/db';
import * as db from '@tloncorp/shared/db';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { v4 as uuidv4 } from 'uuid';

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
  const taskExecutionId = uuidv4();
  const timings: Record<string, number> = {
    start: Date.now(),
  };
  const shipInfo = await storage.shipInfo.getValue();
  if (shipInfo == null) {
    logger.trackEvent('Skipping background sync', {
      context: 'no ship info',
      taskExecutionId,
    });
    return;
  }

  if (
    shipInfo.ship == null ||
    shipInfo.shipUrl == null ||
    shipInfo.authType == null
  ) {
    logger.trackEvent('Skipping background sync', {
      context: 'incomplete ship auth info',
      taskExecutionId,
    });
    return;
  }

  logger.trackEvent('Initiating background sync', { taskExecutionId });

  logger.log('Configuring urbit client...');
  configureUrbitClient({
    ship: shipInfo.ship,
    shipUrl: shipInfo.shipUrl,
    authType: shipInfo.authType,
  });
  logger.log('Configured urbit client.');

  try {
    const unreadsStart = Date.now();
    await syncUnreads();
    timings.unreadsDuration = Date.now() - unreadsStart;
    logger.trackEvent('Background sync: unreads complete', { taskExecutionId });

    const latestPostsStart = Date.now();
    await syncLatestPosts();
    timings.latestPostsDuration = Date.now() - latestPostsStart;
    logger.trackEvent('Background sync: latest posts complete', {
      taskExecutionId,
    });

    logger.trackEvent('Background sync complete', {
      taskExecutionId,
    });
  } catch (err) {
    logger.trackError('Background sync failed', {
      error: err.toString(),
      errorMessage: err instanceof Error ? err.message : undefined,
      taskExecutionId,
      stack: err instanceof Error ? err.stack : undefined,
    });
  } finally {
    logger.trackEvent('Background sync timing', {
      duration: Date.now() - timings.start,
      unreadsDuration: timings.unreadsDuration,
      latestPostsDuration: timings.latestPostsDuration,
      taskExecutionId,
    });
  }
}

export function triggerTaskForTesting() {
  logger.log('Triggering background sync task for testing');
  BackgroundTask.triggerTaskWorkerForTestingAsync();
}

const TASK_ID = 'backgroundSync';
export async function unregisterBackgroundSyncTask() {
  await Notifications.unregisterTaskAsync(TASK_ID);
  await BackgroundTask.unregisterTaskAsync(TASK_ID);
  await TaskManager.unregisterTaskAsync(TASK_ID);
}
export function registerBackgroundSyncTask() {
  TaskManager.defineTask<Record<string, unknown>>(
    TASK_ID,
    async ({ error }): Promise<BackgroundTask.BackgroundTaskResult> => {
      logger.log(`Running background sync background task`);
      if (error) {
        logger.error(`Failed background sync background task`, error.message);
        return BackgroundTask.BackgroundTaskResult.Failed;
      }

      try {
        await performSync();
        // We always return NewData because we don't have a way to know whether
        // there actually was new data.
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch (err) {
        logger.error(
          'Failed background sync',
          err instanceof Error ? err.message : err
        );
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    }
  );

  logger.log('Registered background sync task');
  (async () => {
    try {
      await Notifications.registerTaskAsync(TASK_ID);
      logger.log('Registered notification task');
      await BackgroundTask.registerTaskAsync(TASK_ID, {
        // Uses expo-notification default - at time of writing, 10 minutes on
        // Android, system minimum on iOS (10-15 minutes)
        // minimumInterval: undefined,
      });
      logger.log('Registered background fetch');
    } catch (err) {
      logger.error('Failed to register background sync task', err);
    }
  })();
}
