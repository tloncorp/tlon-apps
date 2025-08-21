import { createDevLogger, syncSince } from '@tloncorp/shared';
import { storage } from '@tloncorp/shared/db';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { v4 as uuidv4 } from 'uuid';

import { configureUrbitClient } from '../hooks/useConfigureUrbitClient';

const logger = createDevLogger('backgroundSync', true);

async function performSync() {
  logger.trackEvent('performing background sync');
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
    const changesStart = Date.now();
    await syncSince();
    timings.changesDuration = Date.now() - changesStart;
    logger.trackEvent('Background sync complete', { taskExecutionId });
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
      changesDuration: timings.changesDuration,
      taskExecutionId,
    });
  }
}

const TASK_ID = 'backgroundFetch';

export async function unregisterBackgroundFetchTask() {
  await Notifications.unregisterTaskAsync(TASK_ID);
  await BackgroundFetch.unregisterTaskAsync(TASK_ID);
  await TaskManager.unregisterTaskAsync(TASK_ID);
}

export function registerBackgroundSyncTask() {
  TaskManager.defineTask<Record<string, unknown>>(
    TASK_ID,
    async ({ error }): Promise<BackgroundFetch.BackgroundFetchResult> => {
      logger.trackEvent(`Running background task`);
      if (error) {
        logger.trackError(`Failed background task`, {
          context: 'called with error',
          errorMessage: error.message,
        });
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }

      try {
        await performSync();
        // We always return NewData because we don't have a way to know whether
        // there actually was new data.
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (err) {
        logger.trackError('Failed background task', {
          context: 'catch',
          errorMessage: err instanceof Error ? err.message : err,
        });
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }
    }
  );

  (async () => {
    try {
      if (await TaskManager.isTaskRegisteredAsync(TASK_ID)) {
        logger.trackEvent('Background sync task is registered');
      } else {
        logger.log('Background sync task is not registered, registering now');
        await BackgroundFetch.registerTaskAsync(TASK_ID, {
          // Uses expo-notification default - at time of writing, 10 minutes on
          // Android, system minimum on iOS (10-15 minutes)
          minimumInterval: 15 * 60,
        });
        logger.trackEvent('Background sync task is registered');
      }
      const status = await TaskManager.getRegisteredTasksAsync();
      logger.trackEvent('Current registered tasks:', {
        tasks: status,
      });
    } catch (err) {
      logger.trackEvent('Failed to register background task', {
        errorMessage: err instanceof Error ? err.message : err,
      });
    }
  })();
}
