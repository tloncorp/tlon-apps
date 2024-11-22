import { useDebouncedValue } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { compact } from 'lodash';
import { useEffect } from 'react';

import { trackError } from '../utils/posthog';
import { connectNotifyProvider } from './notificationsApi';

export const requestNotificationToken = async () => {
  // Skip if running on emulator
  if (!Device.isDevice) {
    return undefined;
  }

  // Fetch current permissions
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  console.debug('Current push notifications status:', status);
  console.debug(
    'Can request push notifications again?',
    canAskAgain ? 'Yes' : 'No'
  );

  // Skip if permission not granted and we can't ask again
  let isGranted = status === 'granted';
  if (!isGranted && !canAskAgain) {
    return;
  }

  // Request permission if not already granted
  if (!isGranted) {
    const { status: nextStatus } =
      await Notifications.requestPermissionsAsync();
    isGranted = nextStatus === 'granted';
    console.debug('New push notifications setting:', nextStatus);
  }

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
async function updatePresentedNotifications() {
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

  const stillPresented = await Notifications.getPresentedNotificationsAsync();
  await Notifications.setBadgeCountAsync(stillPresented.length);
}

export function useUpdatePresentedNotifications() {
  const query = store.useUnreadsCount();

  // `useUnreadsCount` updates with a lot of false positives - debounce so we
  // don't run the updater too frequently
  const debouncedQueryKey = useDebouncedValue(query.dataUpdatedAt, 500);

  useEffect(() => {
    updatePresentedNotifications().catch((err) => {
      console.error('Failed to update presented notifications:', err);
    });
  }, [debouncedQueryKey]);
}
