import Constants from 'expo-constants';

export const NOTIFY_PROVIDER =
  Constants.expoConfig?.extra?.notifyProvider ?? 'rivfur-livmet';
export const NOTIFY_SERVICE =
  Constants.expoConfig?.extra?.notifyService ?? 'android';
