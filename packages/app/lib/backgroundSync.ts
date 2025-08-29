import { createDevLogger, syncSince } from '@tloncorp/shared';
import { storage } from '@tloncorp/shared/db';
import * as BackgroundFetch from 'expo-background-fetch';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { v4 as uuidv4 } from 'uuid';

import { configureUrbitClient } from '../hooks/useConfigureUrbitClient';

// TODO: remove, for use in debugging background tasks
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowBanner: true,
//     shouldShowList: true,
//     shouldPlaySound: false,
//     shouldSetBadge: false,
//     shouldShowAlert: true,
//   }),
// });

// function debugLog(message: string) {
//   Notifications.scheduleNotificationAsync({
//     content: {
//       title: 'Background Log',
//       body: message,
//     },
//     trigger: null,
//   });
// }

const logger = createDevLogger('backgroundSync', true);

async function performSync() {
  const taskExecutionId = uuidv4();
  logger.trackEvent('Initiating background sync', { taskExecutionId });
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
      context: 'incomplete auth',
      taskExecutionId,
    });
    return;
  }

  logger.trackEvent('Configuring urbit client...');
  configureUrbitClient({
    ship: shipInfo.ship,
    shipUrl: shipInfo.shipUrl,
    authType: shipInfo.authType,
  });

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

const TASK_ID = 'tlon:backgroundSync:v1';

export async function unregisterBackgroundSyncTask() {
  await TaskManager.unregisterTaskAsync(TASK_ID);
  await BackgroundTask.unregisterTaskAsync(TASK_ID);
  await BackgroundFetch.unregisterTaskAsync(TASK_ID);
}

export async function removeLegacyTasks() {
  try {
    const registered = await TaskManager.getRegisteredTasksAsync();
    const toRemove = registered.filter((task) => task.taskName !== TASK_ID);
    await Promise.all(
      toRemove.map(async (task) => {
        logger.trackEvent('Removing legacy background task', {
          taskId: task.taskName,
        });
        await TaskManager.unregisterTaskAsync(task.taskName);
        await BackgroundFetch.unregisterTaskAsync(task.taskName);
        await BackgroundTask.unregisterTaskAsync(task.taskName);
      })
    );
  } catch (e) {
    logger.trackEvent('Failed to remove legacy background tasks', {
      errorMessage: e instanceof Error ? e.message : e,
    });
  }
}

export async function registerBackgroundSyncTask() {
  await removeLegacyTasks();

  TaskManager.defineTask<Record<string, unknown>>(
    TASK_ID,
    async ({ error }): Promise<BackgroundTask.BackgroundTaskResult> => {
      logger.trackEvent(`Running background task`);
      if (error) {
        logger.trackError(`Failed background task`, {
          context: 'called with error',
          errorMessage: error.message,
        });
        return BackgroundTask.BackgroundTaskResult.Failed;
      }

      try {
        await performSync();
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch (err) {
        logger.trackError('Failed background task', {
          context: 'catch',
          errorMessage: err instanceof Error ? err.message : err,
        });
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    }
  );

  (async () => {
    try {
      if (await TaskManager.isTaskRegisteredAsync(TASK_ID)) {
        logger.trackEvent('Background sync task is registered');
      } else {
        logger.trackEvent(
          'Background sync task is not registered, registering now'
        );
        await BackgroundTask.registerTaskAsync(TASK_ID, {
          // Uses expo-notification default - at time of writing, 10 minutes on
          // Android, system minimum on iOS (10-15 minutes)
          // minimumInterval: 15 * 60,
        });
        logger.trackEvent('Background sync task is registered');
      }
      const status = await TaskManager.getRegisteredTasksAsync();
      logger.trackEvent('Current registered tasks:', {
        tasks: status,
      });
    } catch (err) {
      logger.trackError('Failed to register background task', {
        errorMessage: err instanceof Error ? err.message : err,
      });
    }
  })();
}
