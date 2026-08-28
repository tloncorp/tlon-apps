import type { Notification } from 'expo-notifications';
import type { TurboModule } from 'react-native';
import { AppState, Platform, TurboModuleRegistry } from 'react-native';

import { pickPlatformPayload } from './dmTapTelemetry';
import { parseNotificationPayload } from './notificationPayload';

type NotificationRoute = {
  name: string;
  params?: Readonly<object>;
};

interface NotificationUrbitModule extends TurboModule {
  setActiveNotificationChannel(channelId: string | null): void;
}

const chatRoutes = new Set(['Channel', 'DM', 'GroupDM', 'Post']);
let activeChannelId: string | null = null;

export function notificationChannelIdFromRoute(
  route: NotificationRoute | undefined
) {
  if (!route || !chatRoutes.has(route.name) || route.params == null) {
    return null;
  }

  const channelId = (route.params as { channelId?: unknown }).channelId;
  return typeof channelId === 'string' ? channelId : null;
}

export function setActiveNotificationRoute(
  route: NotificationRoute | undefined
) {
  const nextChannelId = notificationChannelIdFromRoute(route);
  if (nextChannelId === activeChannelId) {
    return;
  }

  activeChannelId = nextChannelId;
  if (Platform.OS === 'android') {
    TurboModuleRegistry.get<NotificationUrbitModule>(
      'UrbitModule'
    )?.setActiveNotificationChannel(nextChannelId);
  }
}

export function shouldSuppressActiveChannel({
  appIsActive,
  notificationChannelId,
  viewedChannelId,
}: {
  appIsActive: boolean;
  notificationChannelId: string | null;
  viewedChannelId: string | null;
}) {
  return (
    appIsActive &&
    notificationChannelId != null &&
    notificationChannelId === viewedChannelId
  );
}

export function shouldSuppressForegroundNotification(
  notification: Notification
) {
  const data = parseNotificationPayload(pickPlatformPayload(notification));
  const notificationChannelId =
    data != null && 'channelId' in data ? data.channelId : null;

  return shouldSuppressActiveChannel({
    appIsActive: AppState.currentState === 'active',
    notificationChannelId,
    viewedChannelId: activeChannelId,
  });
}
