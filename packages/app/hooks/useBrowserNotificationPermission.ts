import { useCallback, useEffect, useMemo, useState } from 'react';

type BrowserNotificationPermission = NotificationPermission | 'unsupported';

function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (
    typeof window === 'undefined' ||
    !window.isSecureContext ||
    !('Notification' in window)
  ) {
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
    if (
      typeof window === 'undefined' ||
      !window.isSecureContext ||
      !('Notification' in window)
    ) {
      setPermission('unsupported');
      return 'unsupported';
    }

    const nextPermission = await window.Notification.requestPermission();
    setPermission(nextPermission);
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
