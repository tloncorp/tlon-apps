import AsyncStorage from '@react-native-async-storage/async-storage';

import { VolumeUpdate, queryClient } from '../api';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';
import * as db from './types';

const logger = createDevLogger('keyValueStore', true);

export const VOLUME_SETTINGS_QUERY_KEY = ['activity', 'volumeSettings'];
export const ACTIVITY_SEEN_MARKER_QUERY_KEY = [
  'activity',
  'activitySeenMarker',
];
export const ACTIVITY_BUCKET_CURSORS_QUERY_KEY = ['activity', 'bucketCursors'];
export const PUSH_NOTIFICATIONS_SETTING_QUERY_KEY = [
  'settings',
  'pushNotifications',
];

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

export async function storeVolumeSettings(volumeSettings: ub.VolumeSettings) {
  await AsyncStorage.setItem('volumeSettings', JSON.stringify(volumeSettings));
  queryClient.invalidateQueries({ queryKey: VOLUME_SETTINGS_QUERY_KEY });
  logger.log('stored volume settings');
}

export async function getVolumeSettings(): Promise<ub.VolumeSettings> {
  const settings = await AsyncStorage.getItem('volumeSettings');
  return settings ? JSON.parse(settings) : {};
}

export async function mergeVolumeSettings(
  updates: VolumeUpdate[]
): Promise<ub.VolumeSettings> {
  const currentSettings = await getVolumeSettings();
  const newSettings = updates.reduce((acc, { sourceId, volume }) => {
    acc[sourceId] = volume;
    return acc;
  }, {} as ub.VolumeSettings);
  const merged = { ...currentSettings, ...newSettings };
  await storeVolumeSettings(merged);
  logger.log('merged volume settings', merged);
  return merged;
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

export async function setActivityBucketCursor(
  bucketId: db.ActivityBucket,
  cursor: number
) {
  await AsyncStorage.setItem(`bucketCursor:${bucketId}`, cursor.toString());
  queryClient.invalidateQueries({
    queryKey: ACTIVITY_BUCKET_CURSORS_QUERY_KEY,
  });
  logger.log('stored bucket cursor', bucketId, cursor);
}

export async function getActivityBucketCursor(bucketId: db.ActivityBucket) {
  const cursor = await AsyncStorage.getItem(`bucketCursor:${bucketId}`);
  return Number(cursor) ?? Infinity;
}

export async function getActivityBucketCursors() {
  const all = await AsyncStorage.getItem(`bucketCursor:all`);
  const mentions = await AsyncStorage.getItem(`bucketCursor:mentions`);
  const replies = await AsyncStorage.getItem(`bucketCursor:replies`);

  return {
    all: Number(all) ?? Infinity,
    mentions: Number(mentions) ?? Infinity,
    replies: Number(replies) ?? Infinity,
  };
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
