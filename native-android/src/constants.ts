import Constants from 'expo-constants';

export const URBIT_HOME_REGEX = /\<title\>Landscape.*?Home\<\/title\>/i;
export const SHIP_COOKIE_REGEX = /(~)[a-z\-]+?(\=)/;

export const BACKGROUND_NOTIFICATION_TASK =
  'io.tlon.android.background-notification-task';
export const NOTIFY_PROVIDER =
  Constants.expoConfig?.extra?.notifyProvider ?? 'rivfur-livmet';
export const NOTIFY_SERVICE =
  Constants.expoConfig?.extra?.notifyService ?? 'android';
