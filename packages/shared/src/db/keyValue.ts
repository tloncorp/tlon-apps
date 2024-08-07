import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  StorageConfiguration,
  StorageCredentials,
  StorageService,
  queryClient,
} from '../api';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';

const logger = createDevLogger('keyValueStore', true);

export const ACTIVITY_SEEN_MARKER_QUERY_KEY = [
  'activity',
  'activitySeenMarker',
];
export const PUSH_NOTIFICATIONS_SETTING_QUERY_KEY = [
  'settings',
  'pushNotifications',
];

export const IS_TLON_EMPLOYEE_QUERY_KEY = ['settings', 'isTlonEmployee'];
export const APP_INFO_QUERY_KEY = ['settings', 'appInfo'];
export const BASE_VOLUME_SETTING_QUERY_KEY = ['volume', 'base'];

export type ChannelSortPreference = 'recency' | 'arranged';
export async function storeChannelSortPreference(
  sortPreference: ChannelSortPreference
) {
  try {
    await AsyncStorage.setItem('channelSortPreference', sortPreference);
  } catch (error) {
    logger.error('storeChannelSortPreference', error);
  }
}

export async function getChannelSortPreference() {
  try {
    const value = await AsyncStorage.getItem('channelSortPreference');
    return (value ?? 'recency') as ChannelSortPreference;
  } catch (error) {
    logger.error('getChannelSortPreference', error);
  }
}

export async function getActivitySeenMarker() {
  const marker = await AsyncStorage.getItem('activitySeenMarker');
  return Number(marker) ?? 1;
}

export async function storeActivitySeenMarker(timestamp: number) {
  await AsyncStorage.setItem('activitySeenMarker', String(timestamp));
  queryClient.invalidateQueries({ queryKey: ACTIVITY_SEEN_MARKER_QUERY_KEY });
  logger.log('stored activity seen marker', timestamp);
}

export async function setPushNotificationsSetting(
  value: ub.PushNotificationsSetting
) {
  await AsyncStorage.setItem(`settings:pushNotifications`, value);
  queryClient.invalidateQueries({
    queryKey: PUSH_NOTIFICATIONS_SETTING_QUERY_KEY,
  });
  logger.log('stored push notifications setting');
}

export async function getPushNotificationsSetting(): Promise<ub.PushNotificationsSetting> {
  const pushSetting = (await AsyncStorage.getItem(
    `settings:pushNotifications`
  )) as ub.PushNotificationsSetting;
  return pushSetting ?? 'none';
}

export async function setIsTlonEmployee(isTlonEmployee: boolean) {
  await AsyncStorage.setItem('isTlonEmployee', String(isTlonEmployee));
  logger.log('stored isTlonEmployee', isTlonEmployee);
}

export async function getIsTlonEmployee() {
  const isTlonEmployee = await AsyncStorage.getItem('isTlonEmployee');
  return isTlonEmployee === 'true' ? true : false;
}

const STORAGE_CONFIGURATION_KEY = 'storageConfiguration';

export async function setStorageConfiguration(
  configuration: StorageConfiguration
) {
  logger.log('set storage configuration', configuration);
  return AsyncStorage.setItem(
    STORAGE_CONFIGURATION_KEY,
    JSON.stringify(configuration)
  );
}

export async function updateStorageConfiguration(
  update: Partial<StorageConfiguration>
) {
  const current = await getStorageConfiguration();
  if (!current) {
    return;
  }
  return setStorageConfiguration({ ...current, ...update });
}

export async function getStorageConfiguration(): Promise<StorageConfiguration | null> {
  const configuration = await AsyncStorage.getItem(STORAGE_CONFIGURATION_KEY);
  return configuration ? JSON.parse(configuration) : null;
}

export async function addStorageBucket(bucket: string) {
  const current = await getStorageConfiguration();
  if (!current) {
    return;
  }
  if (current.buckets.includes(bucket)) {
    return;
  }
  current.buckets.push(bucket);
  return setStorageConfiguration(current);
}

export async function removeStorageBucket(bucket: string) {
  const current = await getStorageConfiguration();
  if (!current) {
    return;
  }
  current.buckets = current.buckets.filter((b) => b !== bucket);
  return setStorageConfiguration(current);
}

export async function toggleStorageService(service: StorageService) {
  const current = await getStorageConfiguration();
  if (!current) {
    return;
  }
  return setStorageConfiguration({ ...current, service });
}

export const STORAGE_SETTINGS_QUERY_KEY = ['storageSettings'];

const STORAGE_CREDENTIALS_KEY = 'storageCredentials';

export async function setStorageCredentials(credentials: StorageCredentials) {
  logger.log('setStorageCredentials', credentials);
  await AsyncStorage.setItem(
    STORAGE_CREDENTIALS_KEY,
    JSON.stringify(credentials)
  );
  queryClient.invalidateQueries({ queryKey: STORAGE_SETTINGS_QUERY_KEY });
}

export async function getStorageCredentials(): Promise<StorageCredentials | null> {
  const credentials = await AsyncStorage.getItem(STORAGE_CREDENTIALS_KEY);
  return credentials ? JSON.parse(credentials) : null;
}

export async function updateStorageCredentials(
  update: Partial<StorageCredentials>
) {
  logger.log('updateStorageCredentials', update);
  const current = await getStorageCredentials();
  if (!current) {
    return;
  }
  await setStorageCredentials({ ...current, ...update });
  queryClient.invalidateQueries({ queryKey: STORAGE_SETTINGS_QUERY_KEY });
}

export type AppInfo = {
  groupsVersion: string;
  groupsHash: string;
  groupsSyncNode: string;
};

export async function setAppInfoSettings(info: AppInfo) {
  await AsyncStorage.setItem(`settings:appInfo`, JSON.stringify(info));
  queryClient.invalidateQueries({ queryKey: APP_INFO_QUERY_KEY });
  logger.log('stored app info setting');
}

export async function getAppInfoSettings(): Promise<AppInfo | null> {
  const storedAppInfo = await AsyncStorage.getItem(`settings:appInfo`);
  const appInfo = storedAppInfo ? (JSON.parse(storedAppInfo) as AppInfo) : null;
  return appInfo;
}

// export async function getBaseVolumeSetting(): Promise<ub.NotificationLevel> {
//   const volumeSetting = await AsyncStorage.getItem('baseVolumeSetting');
//   return (volumeSetting ?? 'soft') as ub.NotificationLevel;
// }

// export async function setBaseVolumeSetting(
//   volumeSetting: ub.NotificationLevel
// ) {
//   await AsyncStorage.setItem('baseVolumeSetting', volumeSetting);
//   queryClient.invalidateQueries({ queryKey: BASE_VOLUME_SETTING_QUERY_KEY });
//   logger.log('stored base volume setting', volumeSetting);
// }
