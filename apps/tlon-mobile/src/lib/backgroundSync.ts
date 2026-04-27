import { configureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { ensureDbReady } from '@tloncorp/app/lib/nativeDb';
import {
  SyncPriority,
  createDevLogger,
  flushErrorLogger,
  syncContactDiscovery,
  syncSince,
} from '@tloncorp/shared';
import { storage } from '@tloncorp/shared/db';
import * as BackgroundFetch from 'expo-background-fetch';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { v4 as uuidv4 } from 'uuid';

import { refreshHostingAuth } from './hostingAuth';

const logger = createDevLogger('backgroundSync', true);

async function performSync() {
  await ensureDbReady();
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

  let didSucceed = false;

  try {
    // TODO: re-enable when confirmed not causing hangs on Android
    // // use the background task as an opportunity to refresh hosting auth
    // const authPromise = refreshHostingAuth().catch((err) =>
    //   logger.trackError('Background task: failed to refresh hosting auth', {
    //     error: err,
    //   })
    // );

    const changesStart = Date.now();
    await syncSince({
      callCtx: { cause: 'background-sync' },
      syncCtx: {
        priority: SyncPriority.High,
      },
    });
    timings.changesDuration = Date.now() - changesStart;

    // Run lanyard contact discovery as part of the bg cycle so new
    // matches surface even if the user hasn't opened the app recently.
    const discoveryStart = Date.now();
    await syncContactDiscovery().catch((err) => {
      logger.trackError('Background contact discovery failed', {
        error: err instanceof Error ? err : undefined,
        taskExecutionId,
      });
    });
    timings.discoveryDuration = Date.now() - discoveryStart;

    logger.trackEvent('Background sync complete', { taskExecutionId });
    didSucceed = true;

    // await authPromise;
  } catch (err) {
    logger.trackError('Background sync failed', {
      error: err instanceof Error ? err : undefined,
      taskExecutionId,
    });
  } finally {
    logger.trackEvent('Background sync timing', {
      duration: Date.now() - timings.start,
      changesDuration: timings.changesDuration,
      taskExecutionId,
      didSucceed,
    });
    // flush telemetry so events are sent now, not deferred until next foreground
    await Promise.race([
      flushErrorLogger(),
      new Promise<void>((resolve) => setTimeout(resolve, 500)),
    ]).catch(() => {});
  }
}

const TASK_ID = 'tlon:backgroundSync:v2';

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

// Define the background task at module scope - this must happen before registration
TaskManager.defineTask<Record<string, unknown>>(
  TASK_ID,
  async ({ error }): Promise<BackgroundTask.BackgroundTaskResult> => {
    logger.trackEvent(`Running background task`);
    if (error) {
      logger.trackError(`Failed background task`, {
        error,
        context: 'called with error',
      });
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    try {
      await performSync();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (err) {
      logger.trackError('Failed background task', {
        error: err instanceof Error ? err : undefined,
        context: 'catch',
      });
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  }
);

export async function registerBackgroundSyncTask() {
  await removeLegacyTasks();

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
    logger.trackError(
      'Failed to register background task',
      err instanceof Error ? err : undefined
    );
  }
}
