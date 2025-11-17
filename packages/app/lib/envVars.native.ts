import Constants from 'expo-constants';
import { Platform } from 'react-native';

const envVars = (Constants.expoConfig?.extra ?? {}) as Record<
  string,
  string | undefined
>;

function selectRecaptchaSiteKey(platform: string, isAutomatedTest: boolean) {
  if (isAutomatedTest) {
    return (
      (platform === 'android'
        ? envVars.recaptchaSiteKeyAndroidTest
        : envVars.recaptchaSiteKeyIOSTest) ?? ''
    );
  }
  return (
    (platform === 'android'
      ? envVars.recaptchaSiteKeyAndroid
      : envVars.recaptchaSiteKeyIOS) ?? ''
  );
}

export const DEV_SHIP_URL = '';
export const AUTOMATED_TEST = envVars.automatedTest === 'true';
export const INVITE_PROVIDER =
  envVars.inviteProvider ?? 'https://loshut-lonreg.tlon.network';
export const NOTIFY_PROVIDER = envVars.notifyProvider ?? 'rivfur-livmet';
export const NOTIFY_SERVICE = envVars.notifyService ?? 'groups-native';
export const POST_HOG_API_KEY = envVars.postHogApiKey ?? '';
export const SENTRY_DSN = envVars.sentryDsn ?? '';
export const API_URL = envVars.apiUrl ?? 'https://tlon.network';
export const API_AUTH_USERNAME = envVars.apiAuthUsername;
export const API_AUTH_PASSWORD = envVars.apiAuthPassword;
export const RECAPTCHA_SITE_KEY = selectRecaptchaSiteKey(
  Platform.OS,
  AUTOMATED_TEST
);
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
export const INVITE_SERVICE_IS_DEV =
  envVars.inviteServiceIsDev === 'true' ? true : undefined;
export const GIT_HASH = envVars.gitHash ?? 'unknown';
export const OPENROUTER_API_KEY = envVars.openRouterApiKey ?? '';

export const ENV_VARS = {
  DEV_SHIP_URL,
  INVITE_PROVIDER,
  NOTIFY_PROVIDER,
  NOTIFY_SERVICE,
  POST_HOG_API_KEY,
  SENTRY_DSN,
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
  GIT_HASH,
  AUTOMATED_TEST,
  OPENROUTER_API_KEY,
};
