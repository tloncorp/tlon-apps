import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { ThemeName } from 'tamagui';

import {
  StorageConfiguration,
  StorageCredentials,
  StorageService,
  queryClient,
} from '../api';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';
import { NodeBootPhase, SignupParams } from './domainTypes';
import { getStorageMethods } from './getStorageMethods';

const logger = createDevLogger('keyValueStore', false);

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
export const SHOW_BENEFITS_SHEET_QUERY_KEY = ['showBenefitsSheet'];
export const THEME_STORAGE_KEY = '@user_theme';

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

export async function setDidShowBenefitsSheet(didShow: boolean) {
  await AsyncStorage.setItem('didShowBenefitsSheet', didShow.toString());
  queryClient.invalidateQueries({ queryKey: SHOW_BENEFITS_SHEET_QUERY_KEY });
  logger.log('stored didShowBenefitsSheet', didShow);
}

export async function getDidShowBenefitsSheet() {
  const didShow = await AsyncStorage.getItem('didShowBenefitsSheet');
  return didShow === 'true' ? true : false;
}

// new pattern
type StorageItem<T> = {
  key: string;
  defaultValue: T;
  isSecure?: boolean;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
};

const createStorageItem = <T>(config: StorageItem<T>) => {
  const {
    key,
    defaultValue,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
  } = config;
  const storage = getStorageMethods(config.isSecure ?? false);
  let updateLock = Promise.resolve();

  const getValue = async (): Promise<T> => {
    const value = await storage.getItem(key);
    return value ? deserialize(value) : defaultValue;
  };

  const resetValue = async (): Promise<T> => {
    updateLock = updateLock.then(async () => {
      await storage.setItem(key, serialize(defaultValue));
      queryClient.invalidateQueries({ queryKey: [key] });
      logger.log(`reset value ${key}`);
    });
    await updateLock;
    return defaultValue;
  };

  const setValue = async (valueInput: T | ((curr: T) => T)): Promise<void> => {
    updateLock = updateLock.then(async () => {
      let newValue: T;
      if (valueInput instanceof Function) {
        const currValue = await getValue();
        newValue = valueInput(currValue);
      } else {
        newValue = valueInput;
      }

      await storage.setItem(key, serialize(newValue));
      queryClient.invalidateQueries({ queryKey: [key] });
      logger.log(`set value ${key}`, newValue);
    });
    await updateLock;
  };

  function useValue() {
    const { data: value } = useQuery({ queryKey: [key], queryFn: getValue });
    return value === undefined ? defaultValue : value;
  }

  function useStorageItem() {
    const { data: value } = useQuery({ queryKey: [key], queryFn: getValue });
    return {
      value: value === undefined ? defaultValue : value,
      setValue,
      resetValue,
    };
  }

  return { getValue, setValue, resetValue, useValue, useStorageItem };
};

export const signupData = createStorageItem<SignupParams>({
  key: 'signupData',
  defaultValue: {
    hostingUser: null,
    reservedNodeId: null,
    bootPhase: NodeBootPhase.IDLE,
  },
});

export const lastAppVersion = createStorageItem<string | null>({
  key: 'lastAppVersion',
  defaultValue: null,
});

export const didSignUp = createStorageItem<boolean>({
  key: 'didSignUp',
  defaultValue: false,
});

export const didInitializeTelemetry = createStorageItem<boolean>({
  key: 'confirmedAnalyticsOptOut',
  defaultValue: false,
});

export const lastAnonymousAppOpenAt = createStorageItem<number | null>({
  key: 'lastAnonymousAppOpenAt',
  defaultValue: null,
});

export const finishingSelfHostedLogin = createStorageItem<boolean>({
  key: 'finishingSelfHostedLogin',
  defaultValue: false,
});

export const groupsUsedForSuggestions = createStorageItem<string[]>({
  key: 'groupsUsedForSuggestions',
  defaultValue: [],
});

export const postDraft = (opts: {
  key: string;
  type: 'caption' | 'text' | undefined; // matches GalleryDraftType
}) => {
  return createStorageItem<ub.JSONContent | null>({
    key: `draft-${opts.key}${opts.type ? `-${opts.type}` : ''}`,
    defaultValue: null,
  });
};

export const themeSettings = createStorageItem<ThemeName | null>({
  key: THEME_STORAGE_KEY,
  defaultValue: null,
});

export type ChannelSortPreference = 'recency' | 'arranged';

export const channelSortPreference = createStorageItem<ChannelSortPreference>({
  key: 'channelSortPreference',
  defaultValue: 'recency',
});
