import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const SHIP_COOKIE_REGEX = /(~)[a-z\-]+?(\=)/;
export const ACCESS_CODE_REGEX = /^((?:[a-z]{6}-){3}(?:[a-z]{6}))$/i;
export const EMAIL_REGEX =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
export const SHIP_URL_REGEX = /^https?:\/\/([\w-]+\.)+[\w-]+(:\d+)?(?=\/?$)/;
export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<
  string,
  string | undefined
>;

export const NOTIFY_PROVIDER = extra.notifyProvider ?? 'rivfur-livmet';
export const NOTIFY_SERVICE = extra.notifyService ?? 'groups-native';
export const POST_HOG_API_KEY = extra.postHogApiKey ?? '';
export const API_URL = extra.apiUrl ?? 'https://tlon.network';
export const API_AUTH_USERNAME = extra.apiAuthUsername;
export const API_AUTH_PASSWORD = extra.apiAuthPassword;
export const RECAPTCHA_SITE_KEY =
  (IS_ANDROID ? extra.recaptchaSiteKeyAndroid : extra.recaptchaSiteKeyIOS) ??
  '';
export const SHIP_URL_PATTERN =
  extra.shipUrlPattern ?? 'https://{shipId}.tlon.network';
export const DEFAULT_LURE = extra.defaultLure ?? '~nibset-napwyn/tlon';
export const DEFAULT_PRIORITY_TOKEN = extra.defaultPriorityToken ?? 'mobile';
export const DEFAULT_TLON_LOGIN_EMAIL = extra.defaultTlonLoginEmail ?? '';
export const DEFAULT_TLON_LOGIN_PASSWORD = extra.defaultTlonLoginPassword ?? '';
export const DEFAULT_INVITE_LINK_URL = extra.defaultInviteLinkUrl ?? '';
export const DEFAULT_SHIP_LOGIN_URL = extra.defaultShipLoginUrl ?? '';
export const DEFAULT_SHIP_LOGIN_ACCESS_CODE =
  extra.defaultShipLoginAccessCode ?? '';
export const ENABLED_LOGGERS = extra.enabledLoggers?.split(',') ?? [];
export const IGNORE_COSMOS = extra.ignoreCosmos === 'true';
export const TLON_EMPLOYEE_GROUP = extra.TlonEmployeeGroup ?? '';
export const BRANCH_KEY = extra.branchKey ?? '';
export const BRANCH_DOMAIN = extra.branchDomain ?? '';
