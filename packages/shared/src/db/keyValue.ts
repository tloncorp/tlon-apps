import AsyncStorage from '@react-native-async-storage/async-storage';

import { queryClient } from '../api';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';
import * as db from './types';

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
