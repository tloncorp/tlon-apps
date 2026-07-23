import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { isElectron } from './useIsElectron';

type BrowserNotificationPermission = NotificationPermission | 'unsupported';

function browserNotificationsSupported() {
  // Electron uses native desktop notifications (useDesktopNotifications), so
  // browser notifications are not offered there.
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window &&
    !isElectron()
  );
}

function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (!browserNotificationsSupported()) {
    return 'unsupported';
  }

  return window.Notification.permission;
}

export function useBrowserNotificationPermission() {
  const [permission, setPermission] = useState<BrowserNotificationPermission>(
    getBrowserNotificationPermission
  );

  useEffect(() => {
    setPermission(getBrowserNotificationPermission());
  }, []);

  const requestPermission = useCallback(async () => {
    if (!browserNotificationsSupported()) {
      setPermission('unsupported');
      return 'unsupported';
    }

    const nextPermission = await window.Notification.requestPermission();
    setPermission(nextPermission);
    trackEvent(AnalyticsEvent.ActionsNotifPermsChecked, {
      isGranted: nextPermission === 'granted',
      canAskAgain: nextPermission === 'default',
    });
    return nextPermission;
  }, []);

  return useMemo(
    () => ({
      isSupported: permission !== 'unsupported',
      permission,
      hasPermission: permission === 'granted',
      canRequestPermission: permission === 'default',
      requestPermission,
    }),
    [permission, requestPermission]
  );
}
