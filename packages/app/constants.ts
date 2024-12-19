import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const SHIP_COOKIE_REGEX = /(~)[a-z\-]+?(\=)/;
export const ACCESS_CODE_REGEX = /^((?:[a-z]{6}-){3}(?:[a-z]{6}))$/i;
export const EMAIL_REGEX =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
export const SHIP_URL_REGEX = /^https?:\/\/([\w-]+\.)+[\w-]+(:\d+)?(?=\/?$)/;
export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';

function formatWebEnv() {
  // @ts-expect-error — TS doesn't like accessing import like that from a non-module file?
  const env = import.meta.env;
  return {
    notifyProvider: env.VITE_NOTIFY_PROVIDER,
    notifyService: env.VITE_NOTIFY_SERVICE,
    postHogApiKey: env.VITE_POST_HOG_API_KEY,
    apiUrl: env.VITE_API_URL,
    apiAuthUsername: env.VITE_API_AUTH_USERNAME,
    apiAuthPassword: env.VITE_API_AUTH_PASSWORD,
    recaptchaSiteKey: env.VITE_RECAPTCHA_SITE_KEY,
    shipUrlPattern: env.VITE_SHIP_URL_PATTERN,
    defaultLure: env.VITE_DEFAULT_LURE,
    defaultPriorityToken: env.VITE_DEFAULT_PRIORITY_TOKEN,
    defaultTlonLoginEmail: env.VITE_DEFAULT_TLON_LOGIN_EMAIL,
    defaultTlonLoginPassword: env.VITE_DEFAULT_TLON_LOGIN_PASSWORD,
    defaultInviteLinkUrl: env.VITE_DEFAULT_INVITE_LINK_URL,
    defaultShipLoginUrl: env.VITE_DEFAULT_SHIP_LOGIN_URL,
    defaultShipLoginAccessCode: env.VITE_DEFAULT_SHIP_LOGIN_ACCESS_CODE,
    defaultOnboardingPassword: env.VITE_DEFAULT_ONBOARDING_PASSWORD,
    defaultOnboardingTlonEmail: env.VITE_DEFAULT_ONBOARDING_TLON_EMAIL,
    defaultOnboardingNickname: env.VITE_DEFAULT_ONBOARDING_NICKNAME,
    defaultOnboardingPhoneNumber: env.VITE_DEFAULT_ONBOARDING_PHONE_NUMBER,
    enabledLoggers: env.VITE_ENABLED_LOGGERS,
    ignoreCosmos: env.VITE_IGNORE_COSMOS,
    TlonEmployeeGroup: env.VITE_TLON_EMPLOYEE_GROUP,
    branchKey: env.VITE_BRANCH_KEY,
    branchDomain: env.VITE_BRANCH_DOMAIN,
    inviteServiceEndpoint: env.VITE_INVITE_SERVICE_ENDPOINT,
    inviteServiceIsDev: env.VITE_INVITE_SERVICE_IS_DEV,
  };
}

const envVars = (Constants.expoConfig?.extra ?? formatWebEnv() ?? {}) as Record<
  string,
  string | undefined
>;

export const NOTIFY_PROVIDER = envVars.notifyProvider ?? 'rivfur-livmet';
export const NOTIFY_SERVICE = envVars.notifyService ?? 'groups-native';
export const POST_HOG_API_KEY = envVars.postHogApiKey ?? '';
export const API_URL = envVars.apiUrl ?? 'https://tlon.network';
export const API_AUTH_USERNAME = envVars.apiAuthUsername;
export const API_AUTH_PASSWORD = envVars.apiAuthPassword;
export const RECAPTCHA_SITE_KEY =
  (IS_ANDROID
    ? envVars.recaptchaSiteKeyAndroid
    : envVars.recaptchaSiteKeyIOS) ?? '';
export const SHIP_URL_PATTERN =
  envVars.shipUrlPattern ?? 'https://{shipId}.tlon.network';
export const DEFAULT_LURE = envVars.defaultLure ?? '~nibset-napwyn/tlon';
export const DEFAULT_PRIORITY_TOKEN = envVars.defaultPriorityToken ?? 'mobile';
export const DEFAULT_TLON_LOGIN_EMAIL = envVars.defaultTlonLoginEmail ?? '';
export const DEFAULT_TLON_LOGIN_PASSWORD =
  envVars.defaultTlonLoginPassword ?? '';
export const DEFAULT_INVITE_LINK_URL = envVars.defaultInviteLinkUrl ?? '';
export const DEFAULT_SHIP_LOGIN_URL = envVars.defaultShipLoginUrl ?? '';
export const DEFAULT_SHIP_LOGIN_ACCESS_CODE =
  envVars.defaultShipLoginAccessCode ?? '';
export const DEFAULT_ONBOARDING_PASSWORD =
  envVars.defaultOnboardingPassword ?? '';
export const DEFAULT_ONBOARDING_TLON_EMAIL =
  envVars.defaultOnboardingTlonEmail ?? '';
export const DEFAULT_ONBOARDING_NICKNAME =
  envVars.defaultOnboardingNickname ?? '';
export const DEFAULT_ONBOARDING_PHONE_NUMBER =
  envVars.defaultOnboardingPhoneNumber;

export const ENABLED_LOGGERS = envVars.enabledLoggers?.split(',') ?? [];
export const IGNORE_COSMOS = envVars.ignoreCosmos === 'true';
export const TLON_EMPLOYEE_GROUP = envVars.TlonEmployeeGroup ?? '';
export const BRANCH_KEY = envVars.branchKey ?? '';
export const BRANCH_DOMAIN = envVars.branchDomain ?? '';
export const INVITE_SERVICE_ENDPOINT = envVars.inviteServiceEndpoint ?? '';
export const INVITE_SERVICE_IS_DEV = envVars.inviteServiceIsDev === 'true';

export const ENV_VARS = {
  NOTIFY_PROVIDER,
  NOTIFY_SERVICE,
  POST_HOG_API_KEY,
  API_URL,
  API_AUTH_USERNAME,
  API_AUTH_PASSWORD,
  RECAPTCHA_SITE_KEY,
  SHIP_URL_PATTERN,
  DEFAULT_LURE,
  DEFAULT_PRIORITY_TOKEN,
  DEFAULT_TLON_LOGIN_EMAIL,
  DEFAULT_TLON_LOGIN_PASSWORD,
  DEFAULT_INVITE_LINK_URL,
  DEFAULT_SHIP_LOGIN_URL,
  DEFAULT_SHIP_LOGIN_ACCESS_CODE,
  DEFAULT_ONBOARDING_PASSWORD,
  DEFAULT_ONBOARDING_TLON_EMAIL,
  DEFAULT_ONBOARDING_NICKNAME,
  DEFAULT_ONBOARDING_PHONE_NUMBER,
  ENABLED_LOGGERS,
  IGNORE_COSMOS,
  TLON_EMPLOYEE_GROUP,
  BRANCH_KEY,
  BRANCH_DOMAIN,
  INVITE_SERVICE_ENDPOINT,
  INVITE_SERVICE_IS_DEV,
};
