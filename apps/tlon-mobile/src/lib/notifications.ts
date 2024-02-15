import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

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
