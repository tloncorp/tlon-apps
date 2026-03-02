import { configureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { runMigrations, setupDb } from '@tloncorp/app/lib/nativeDb';
import { SyncPriority, createDevLogger, syncSince } from '@tloncorp/shared';
import { storage } from '@tloncorp/shared/db';
import * as BackgroundFetch from 'expo-background-fetch';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { v4 as uuidv4 } from 'uuid';

import { refreshHostingAuth } from './hostingAuth';

const logger = createDevLogger('backgroundSync', true);

let backgroundSyncAbortController: AbortController | null = null;

export function cancelBackgroundSync() {
  if (backgroundSyncAbortController) {
    logger.trackEvent('Cancelling background sync (app foregrounded)');
    backgroundSyncAbortController.abort();
    backgroundSyncAbortController = null;
  }
}

async function performSync() {
  await setupDb();
  await runMigrations();
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
    // use the background task as an opportunity to refresh hosting auth
    const authPromise = refreshHostingAuth().catch((err) =>
      logger.trackError('Background task: failed to refresh hosting auth', {
        error: err,
      })
    );
    // Abort any previous background sync and create a fresh controller.
    // If the app comes to foreground, cancelBackgroundSync() will abort
    // this controller, removing queued operations from the sync queue so
    // they don't contend with foreground sync.
    backgroundSyncAbortController?.abort();
    backgroundSyncAbortController = new AbortController();
    const changesStart = Date.now();
    await syncSince({
      callCtx: { cause: 'background-sync' },
      syncCtx: {
        priority: SyncPriority.High,
        abortSignal: backgroundSyncAbortController.signal,
      },
    });
    timings.changesDuration = Date.now() - changesStart;
    logger.trackEvent('Background sync complete', { taskExecutionId });
    await authPromise;
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
    });
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
