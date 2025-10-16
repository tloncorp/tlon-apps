const TLON_NAMESPACE = 'tlonEnv';

interface Constants {
  DEV_SHIP_URL: string;
  INVITE_PROVIDER: string;
  NOTIFY_PROVIDER: string;
  NOTIFY_SERVICE: string;
  POST_HOG_API_KEY: string;
  API_URL: string;
  API_AUTH_USERNAME: string | undefined;
  API_AUTH_PASSWORD: string | undefined;
  RECAPTCHA_SITE_KEY: string;
  SHIP_URL_PATTERN: string;
  DEFAULT_LURE: string;
  DEFAULT_PRIORITY_TOKEN: string;
  DEFAULT_TLON_LOGIN_EMAIL: string;
  DEFAULT_TLON_LOGIN_PASSWORD: string;
  DEFAULT_INVITE_LINK_URL: string;
  DEFAULT_SHIP_LOGIN_URL: string;
  DEFAULT_SHIP_LOGIN_ACCESS_CODE: string;
  DEFAULT_ONBOARDING_PASSWORD: string;
  DEFAULT_ONBOARDING_TLON_EMAIL: string;
  DEFAULT_ONBOARDING_NICKNAME: string;
  DEFAULT_ONBOARDING_PHONE_NUMBER: string | undefined;
  ENABLED_LOGGERS: string[];
  IGNORE_COSMOS: boolean;
  TLON_EMPLOYEE_GROUP: string;
  BRANCH_KEY: string;
  BRANCH_DOMAIN: string;
  INVITE_SERVICE_ENDPOINT: string;
  INVITE_SERVICE_IS_DEV: boolean;
  GIT_HASH: string;
  DISABLE_SPLASH_MODAL: boolean;
  AUTOMATED_TEST: boolean;
}

export function getConstants(): Constants {
  if (
    window &&
    (window as any)[TLON_NAMESPACE] &&
    typeof (window as any)[TLON_NAMESPACE] === 'object'
  ) {
    return (window as any)[TLON_NAMESPACE] as Constants;
  }

  return (global as any)[TLON_NAMESPACE] as Constants;
}
