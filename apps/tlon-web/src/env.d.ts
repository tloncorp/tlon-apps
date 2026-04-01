interface ImportMetaEnv
  extends Readonly<Record<string, string | boolean | undefined>> {
  readonly VITE_LAST_WIPE: string;
  readonly VITE_STORAGE_VERSION: string;
  readonly VITE_ENABLE_WDYR: 'true' | 'false' | undefined;
  readonly VITE_NOTIFY_PROVIDER: string | undefined;
  readonly VITE_NOTIFY_SERVICE: string | undefined;
  readonly VITE_POST_HOG_API_KEY: string;
  readonly VITE_API_URL: string | undeined;
  readonly VITE_API_AUTH_USERNAME: string | undefined;
  readonly VITE_API_AUTH_PASSWORD: string | undefined;
  readonly VITE_RECAPTCHA_SITE_KEY: string | undefined;
  readonly VITE_SHIP_URL_PATTERN: string | undefined;
  readonly VITE_DEFAULT_LURE: string | undefined;
  readonly VITE_DEFAULT_PRIORITY_TOKEN: string | undefined;
  readonly VITE_DEFAULT_TLON_LOGIN_EMAIL: string | undefined;
  readonly VITE_DEFAULT_TLON_LOGIN_PASSWORD: string | undefined;
  readonly VITE_DEFAULT_INVITE_LINK_URL: string | undefined;
  readonly VITE_DEFAULT_SHIP_LOGIN_URL: string | undefined;
  readonly VITE_DEFAULT_SHIP_LOGIN_ACCESS_CODE: string | undefined;
  readonly VITE_DEFAULT_ONBOARDING_PASSWORD: string | undefined;
  readonly VITE_DEFAULT_ONBOARDING_TLON_EMAIL: string | undefined;
  readonly VITE_DEFAULT_ONBOARDING_NICKNAME: string | undefined;
  readonly VITE_DEFAULT_ONBOARDING_PHONE_NUMBER: string | undefined;
  readonly VITE_ENABLED_LOGGERS: string | undefined;
  readonly VITE_IGNORE_COSMOS: 'true' | 'false' | undefined;
  readonly VITE_TLON_EMPLOYEE_GROUP: string | undefined;
  readonly VITE_BRANCH_KEY: string;
  readonly VITE_BRANCH_DOMAIN: string;
  readonly VITE_SHIP_URL: string;
  readonly VITE_INVITE_SERVICE_ENDPOINT: string;
  readonly VITE_INVITE_SERVICE_IS_DEV: 'true' | 'false' | undefined;
  readonly VITE_GIT_HASH: string | undefined;
  readonly VITE_DISABLE_SPLASH_MODAL: 'true' | 'false' | undefined;
  readonly VITE_AUTOMATED_TEST: 'true' | 'false' | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
