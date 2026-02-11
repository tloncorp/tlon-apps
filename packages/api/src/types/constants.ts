const TLON_NAMESPACE = 'tlonEnv';

export interface Constants {
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
  OPENROUTER_API_KEY: string;
}

/**
 * Default constants for standalone usage.
 * These can be overridden by setting window.tlonEnv (browser) or global.tlonEnv (Node.js).
 */
const DEFAULT_CONSTANTS: Constants = {
  DEV_SHIP_URL: '',
  INVITE_PROVIDER: '~wannec-dansen',
  NOTIFY_PROVIDER: '~wannec-dansen',
  NOTIFY_SERVICE: 'notify',
  POST_HOG_API_KEY: '',
  API_URL: 'https://api.tlon.io',
  API_AUTH_USERNAME: undefined,
  API_AUTH_PASSWORD: undefined,
  RECAPTCHA_SITE_KEY: '',
  SHIP_URL_PATTERN: 'https://{shipId}.tlon.network',
  DEFAULT_LURE: '',
  DEFAULT_PRIORITY_TOKEN: '',
  DEFAULT_TLON_LOGIN_EMAIL: '',
  DEFAULT_TLON_LOGIN_PASSWORD: '',
  DEFAULT_INVITE_LINK_URL: '',
  DEFAULT_SHIP_LOGIN_URL: '',
  DEFAULT_SHIP_LOGIN_ACCESS_CODE: '',
  DEFAULT_ONBOARDING_PASSWORD: '',
  DEFAULT_ONBOARDING_TLON_EMAIL: '',
  DEFAULT_ONBOARDING_NICKNAME: '',
  DEFAULT_ONBOARDING_PHONE_NUMBER: undefined,
  ENABLED_LOGGERS: [],
  IGNORE_COSMOS: false,
  TLON_EMPLOYEE_GROUP: '~natnex-ronret/tlon',
  BRANCH_KEY: '',
  BRANCH_DOMAIN: 'tlon.network',
  INVITE_SERVICE_ENDPOINT: 'https://invite.tlon.io',
  INVITE_SERVICE_IS_DEV: false,
  GIT_HASH: '',
  DISABLE_SPLASH_MODAL: false,
  AUTOMATED_TEST: false,
  OPENROUTER_API_KEY: '',
};

/**
 * Get runtime constants. Checks window.tlonEnv (browser), global.tlonEnv (Node.js),
 * then falls back to defaults. You can configure by setting:
 * - Browser: window.tlonEnv = { ... }
 * - Node.js: global.tlonEnv = { ... }
 */
export function getConstants(): Constants {
  // Check browser window
  if (typeof window !== 'undefined' && (window as any)[TLON_NAMESPACE]) {
    return { ...DEFAULT_CONSTANTS, ...(window as any)[TLON_NAMESPACE] };
  }

  // Check Node.js global
  if (typeof global !== 'undefined' && (global as any)[TLON_NAMESPACE]) {
    return { ...DEFAULT_CONSTANTS, ...(global as any)[TLON_NAMESPACE] };
  }

  // Return defaults for standalone usage
  return DEFAULT_CONSTANTS;
}

/**
 * Configure constants programmatically (useful for standalone usage).
 */
export function configureConstants(constants: Partial<Constants>): void {
  if (typeof window !== 'undefined') {
    (window as any)[TLON_NAMESPACE] = { ...getConstants(), ...constants };
  } else if (typeof global !== 'undefined') {
    (global as any)[TLON_NAMESPACE] = { ...getConstants(), ...constants };
  }
}

export function isOpenRouterConfigured(): boolean {
  const constants = getConstants();
  return !!constants.OPENROUTER_API_KEY && constants.OPENROUTER_API_KEY.length > 0;
}
