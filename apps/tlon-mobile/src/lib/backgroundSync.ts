import { configureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { ensureDbReady } from '@tloncorp/app/lib/nativeDb';
import {
  presentContactMatchNotification,
  presentContactsMatchedNotification,
} from '@tloncorp/app/lib/notifications';
import {
  SyncPriority,
  createDevLogger,
  flushErrorLogger,
  syncContactDiscovery,
  syncSince,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { storage } from '@tloncorp/shared/db';
import * as BackgroundFetch from 'expo-background-fetch';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { v4 as uuidv4 } from 'uuid';

const logger = createDevLogger('backgroundSync', true);

async function performSync() {
  await ensureDbReady();
  const taskExecutionId = uuidv4();
  logger.trackEvent('Initiating background sync', { taskExecutionId });
  const timings: Record<string, number> = {
    start: Date.now(),
  };
  logger.log('Loading stored ship info...');
  const shipInfo = await storage.shipInfo.getValue();
  logger.log('Loaded stored ship info', {
    hasShipInfo: shipInfo != null,
    hasShip: shipInfo?.ship != null,
    hasShipUrl: shipInfo?.shipUrl != null,
    authType: shipInfo?.authType,
  });
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
    logger.log('Syncing since last successful sync...');
    await syncSince({
      callCtx: { cause: 'background-sync' },
      syncCtx: {
        priority: SyncPriority.High,
      },
    });
    timings.changesDuration = Date.now() - changesStart;

    // Run lanyard contact discovery as part of the bg cycle so new
    // matches surface even if the user hasn't opened the app recently.
    // We disable the registered-handler path because in a bg task there's
    // no React tree (and so no useNotificationListener-registered
    // handler) — instead we schedule a local notification directly.
    logger.log('Running contact discovery...');
    const discoveryStart = Date.now();
    const discoveryResult = await syncContactDiscovery(undefined, {
      invokeHandler: false,
    }).catch((err) => {
      logger.trackError('Background contact discovery failed', {
        error: err instanceof Error ? err : undefined,
        taskExecutionId,
      });
      return null;
    });
    logger.trackEvent('Background contact discovery complete', {
      discoveryResult,
      taskExecutionId,
    });
    timings.discoveryDuration = Date.now() - discoveryStart;

    if (discoveryResult && discoveryResult.newMatches.length > 0) {
      logger.log('Notifying about new matches...', {
        newMatches: discoveryResult.newMatches,
      });
      await notifyAboutNewMatches(
        discoveryResult.newMatches.map(([, contactId]) => contactId)
      ).catch((err) => {
        logger.trackError('Background match notification failed', {
          error: err instanceof Error ? err : undefined,
          taskExecutionId,
        });
      });

      logger.trackEvent('New matches notification', {
        count: discoveryResult.newMatches.length,
        taskExecutionId,
      });
    }

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
    logger.log('Finished background sync finalization');
  }
}

export async function runBackgroundSyncFromDebugButton() {
  logger.log('Debug UI trigger pressed');
  await performSync();
  logger.log('Debug UI trigger complete');
}

// In foreground, useNotificationListener registers a handler that turns
// a new-match event into a local notification. In a bg task there's no
// React tree — and therefore no registered handler — so the bg path
// schedules the notification directly with the same shape of copy.
async function notifyAboutNewMatches(contactIds: string[]) {
  // Don't notify on the very first install sync — the user could have
  // a phone book full of matches and we don't want to flood. The
  // foreground syncStart sets userHasCompletedFirstSync to true once
  // initial sync wraps; subsequent bg runs (this code path) hit that
  // branch and notify normally.
  logger.log('Checking first-sync gate before match notification', {
    count: contactIds.length,
  });
  const hasCompletedFirstSync = await db.userHasCompletedFirstSync.getValue();
  logger.log('First-sync gate result', { hasCompletedFirstSync });
  if (!hasCompletedFirstSync) return;

  if (contactIds.length === 1) {
    const [contactId] = contactIds;
    const systemContacts =
      await db.getSystemContactsBatchByContactId(contactIds);
    const sc = systemContacts.find((c) => c.contactId === contactId);
    const name =
      [sc?.firstName, sc?.lastName].filter(Boolean).join(' ').trim() ||
      contactId;
    logger.log('Presenting single contact match notification', {
      contactId,
      name,
    });
    await presentContactMatchNotification({ contactId, name });
  } else {
    logger.log('Presenting contacts matched notification', {
      count: contactIds.length,
    });
    await presentContactsMatchedNotification({ count: contactIds.length });
  }
}

const TASK_ID = 'tlon:backgroundSync:v2';

logger.log('backgroundSync module loaded; defining task', {
  taskId: TASK_ID,
});

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
  async ({
    data,
    error,
    executionInfo,
  }): Promise<BackgroundTask.BackgroundTaskResult> => {
    logger.trackEvent('Running background task', {
      data,
      error,
      executionInfo,
    });
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
