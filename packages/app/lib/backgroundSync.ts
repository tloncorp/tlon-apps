import {
  createDevLogger,
  syncLatestChanges,
  syncLatestPosts,
  syncSince,
  syncUnreads,
} from '@tloncorp/shared';
import { storage } from '@tloncorp/shared/db';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { configureUrbitClient } from '../hooks/useConfigureUrbitClient';

// TODO: remove, for use in debugging background tasks
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowAlert: true,
  }),
});

const DEBUG_LOGS: string[] = [];

AppState.addEventListener('change', (nextState) => {
  if (nextState === 'active') {
    console.log(DEBUG_LOGS);
  }
});

function debugLog(message: string) {
  DEBUG_LOGS.push(message);

  Notifications.scheduleNotificationAsync({
    content: {
      title: 'Background Log',
      body: message,
    },
    trigger: null,
  });
}

const logger = createDevLogger('backgroundSync', true);

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

  debugLog('Configuring urbit client...');
  configureUrbitClient({
    ship: shipInfo.ship,
    shipUrl: shipInfo.shipUrl,
    authType: shipInfo.authType,
  });
  debugLog('Configured urbit client.');

  try {
    const changesStart = Date.now();
    await syncSince();
    timings.changesDuration = Date.now() - changesStart;
    logger.trackEvent('Background sync: changes complete', { taskExecutionId });

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
      changesDuration: timings.changesDuration,
      taskExecutionId,
    });
  }
}

export async function triggerTaskForTesting() {
  debugLog('Triggering background sync task for testing');
  let result: any = null;
  try {
    result = await BackgroundTask.triggerTaskWorkerForTestingAsync();
  } catch (err) {
    debugLog(`Error: ${err.message}`);
  } finally {
    debugLog(`Finished test trigger ${result}`);
  }
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
      debugLog(`Running background sync background task`);
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

  (async () => {
    try {
      console.log('Status', await BackgroundTask.getStatusAsync());
      if (await TaskManager.isTaskRegisteredAsync(TASK_ID)) {
        debugLog('Background sync task is registered');
      } else {
        debugLog('Background sync task is not registered, registering now');
        await BackgroundTask.registerTaskAsync(TASK_ID);
        debugLog('Registered background sync task');
      }
    } catch (err) {
      logger.error('Failed to register background sync task', err);
    }
  })();
}
