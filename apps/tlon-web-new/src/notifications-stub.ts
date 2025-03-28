// Stub implementation of expo-notifications for desktop environments
// This provides a minimal subset of the methods from expo-notifications
// needed for our application

export const cancelScheduledNotificationAsync = async (
  identifier: string
): Promise<void> => {
  console.log(`[Notifications Stub] Canceling scheduled notification: ${identifier}`);
  return Promise.resolve();
};

export const getPresentedNotificationsAsync = async () => {
  console.log('[Notifications Stub] Getting presented notifications');
  return Promise.resolve([]);
};

export const getPermissionsAsync = async () => {
  console.log('[Notifications Stub] Getting notification permissions');
  return Promise.resolve({
    status: 'granted',
    canAskAgain: false,
  });
};

export const requestPermissionsAsync = async () => {
  console.log('[Notifications Stub] Requesting notification permissions');
  return Promise.resolve({
    status: 'granted',
  });
};

export const setBadgeCountAsync = async (count: number) => {
  console.log(`[Notifications Stub] Setting badge count: ${count}`);
  return Promise.resolve();
};

export const dismissNotificationAsync = async (identifier: string) => {
  console.log(`[Notifications Stub] Dismissing notification: ${identifier}`);
  return Promise.resolve();
};

export const getAllScheduledNotificationsAsync = async () => {
  console.log('[Notifications Stub] Getting all scheduled notifications');
  return Promise.resolve([]);
};

export const scheduleNotificationAsync = async (options: any) => {
  console.log('[Notifications Stub] Scheduling notification:', options);
  return Promise.resolve();
};

export const addNotificationResponseReceivedListener = () => {
  console.log('[Notifications Stub] Adding notification response listener');
  return {
    remove: () => {
      console.log('[Notifications Stub] Removing notification response listener');
    },
  };
};
