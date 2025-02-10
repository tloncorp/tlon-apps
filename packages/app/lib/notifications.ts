import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { compact } from 'lodash';
import { useEffect } from 'react';

import { trackError } from '../utils/posthog';
import { connectNotifyProvider } from './notificationsApi';

const logger = createDevLogger('notifications', true);

/** Returns true if notification permission is thought to be granted, false otherwise */
async function requestNotificationPermissionsIfNeeded(): Promise<boolean> {
  // Fetch current permissions
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  logger.debug('Current push notifications status:', status);
  logger.debug(
    'Can request push notifications again?',
    canAskAgain ? 'Yes' : 'No'
  );

  let isGranted = status === 'granted';
  if (isGranted) {
    return true;
  }

  // Skip if permission not granted and we can't ask again
  if (!isGranted && !canAskAgain) {
    return false;
  }

  // Request permission if not already granted
  if (!isGranted) {
    const { status: nextStatus } =
      await Notifications.requestPermissionsAsync();
    isGranted = nextStatus === 'granted';
    logger.debug('New push notifications setting:', nextStatus);
  }

  return isGranted;
}

export const requestNotificationToken = async () => {
  // Skip if running on emulator
  if (!Device.isDevice) {
    return undefined;
  }

  const isGranted = await requestNotificationPermissionsIfNeeded();

  // Skip if permission explicitly not granted
  if (!isGranted) {
    return undefined;
  }

  // Get device push token
  const { data: token } = await Notifications.getDevicePushTokenAsync();
  console.debug('Received push notifications token:', token);
  return token as string;
};

export const connectNotifications = async () => {
  let token: string | undefined;
  try {
    token = await requestNotificationToken();
  } catch (err) {
    console.error('Error requesting push notifications token:', err);
    if (err instanceof Error) {
      trackError(err, 'notifications_request_error');
    }
  }

  if (!token) {
    return false;
  }

  try {
    await connectNotifyProvider(token);
    return true;
  } catch (err) {
    console.error('Error connecting push notifications provider:', err);
    if (err instanceof Error) {
      trackError(err, 'notifications_register_error');
    }
    return false;
  }
};

const channelIdFromNotification = (notif: Notifications.Notification) => {
  if (notif.request.trigger.type !== 'push') {
    return null;
  }
  const out = notif.request.trigger.payload?.channelId;
  if (typeof out !== 'string') {
    return null;
  }
  return out;
};

/**
 * Imprecise method to sync internal unreads with presented notifications.
 * We should move to a serverside badge + dismiss notification system, and remove this.
 */
async function updatePresentedNotifications(badgeCount?: number) {
  const presentedNotifs = await Notifications.getPresentedNotificationsAsync();
  const allChannelIds = new Set(
    compact(presentedNotifs.map(channelIdFromNotification))
  );

  const fullyReadChannels = new Set<string>();
  for await (const channelId of allChannelIds) {
    const channel = await db.getChannelWithRelations({ id: channelId });
    if (channel?.unread?.count === 0) {
      fullyReadChannels.add(channelId);
    }
  }

  const notificationsToDelete = presentedNotifs.filter((notif) => {
    const cId = channelIdFromNotification(notif);
    // also delete notifications that have no channel id to avoid stuck notifs
    return cId == null || fullyReadChannels.has(cId);
  });

  await Promise.all(
    notificationsToDelete.map(async (notif) => {
      await Notifications.dismissNotificationAsync(notif.request.identifier);
    })
  );

  // NOTE: removing badging for now
  // const count =
  //   badgeCount ?? (await Notifications.getPresentedNotificationsAsync()).length;
  // await Notifications.setBadgeCountAsync(count);
}

export function useUpdatePresentedNotifications() {
  const { data: unreadCount } = store.useUnreadsCountWithoutMuted();
  useEffect(() => {
    updatePresentedNotifications(unreadCount).catch((err) => {
      console.error('Failed to update presented notifications:', err);
    });
  }, [unreadCount]);
}

// Internal ID for this notification. We use a static ID so we can (1) check
// for existing nudges, and (2) ensure we always overwrite an existing nudge if
// one was not canceled: we don't want two concurrent nudges scheduled.
const NODE_RESUME_NUDGE_ID = 'node-resume-nudge';

const NUDGE_DELAY_SECONDS = 10 * 60; // 10 minutes

export async function scheduleNodeResumeNudge(ship: string) {
  const hasPermission = await requestNotificationPermissionsIfNeeded();
  if (!hasPermission) {
    return;
  }

  // We don't want to reset the timer if it's already scheduled - check for
  // an existing nudge for this ship and bail if one exists.
  const scheduledNotifications =
    await Notifications.getAllScheduledNotificationsAsync();
  const isAlreadyScheduled = scheduledNotifications.some(
    (n) =>
      n.identifier === NODE_RESUME_NUDGE_ID && n.content.data?.ship === ship
  );
  if (isAlreadyScheduled) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: NODE_RESUME_NUDGE_ID,
    content: {
      title: "We're ready for you now",
      body: 'Tap here to log in to your ship',
      data: { ship },
    },
    trigger: {
      seconds: NUDGE_DELAY_SECONDS,
    },
  });
}
export async function cancelNodeResumeNudge() {
  await Notifications.cancelScheduledNotificationAsync(NODE_RESUME_NUDGE_ID);
}
