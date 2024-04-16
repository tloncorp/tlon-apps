import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const projectId = '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0';
const isPreview = (process.env as any).APP_VARIANT === 'preview';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: 'tlon',
  slug: 'groups',
  name: isPreview ? 'Tlon - Preview' : 'Tlon',
  assetBundlePatterns: ['**/*'],
  userInterfaceStyle: 'automatic',
  extra: {
    eas: {
      projectId,
    },
    postHogApiKey: (process.env as any).POST_HOG_API_KEY,
    notifyProvider: (process.env as any).NOTIFY_PROVIDER,
    notifyService: (process.env as any).NOTIFY_SERVICE,
    apiUrl: (process.env as any).API_URL,
    apiAuthUsername: (process.env as any).API_AUTH_USERNAME,
    apiAuthPassword: (process.env as any).API_AUTH_PASSWORD,
    shipUrlPattern: (process.env as any).SHIP_URL_PATTERN,
    defaultLure: (process.env as any).DEFAULT_LURE,
    defaultPriorityToken: (process.env as any).DEFAULT_PRIORITY_TOKEN,
    defaultTlonLoginEmail: (process.env as any).DEFAULT_TLON_LOGIN_EMAIL,
    defaultTlonLoginPassword: (process.env as any).DEFAULT_TLON_LOGIN_PASSWORD,
    defaultShipLoginUrl: (process.env as any).DEFAULT_SHIP_LOGIN_URL,
    defaultShipLoginAccessCode: (process.env as any)
      .DEFAULT_SHIP_LOGIN_ACCESS_CODE,
    recaptchaSiteKeyAndroid: (process.env as any).RECAPTCHA_SITE_KEY_ANDROID,
    recaptchaSiteKeyIOS: (process.env as any).RECAPTCHA_SITE_KEY_IOS,
    enabledLoggers: (process.env as any).ENABLED_LOGGERS,
  },
  ios: {
    runtimeVersion: '4.0.0',
    buildNumber: '62',
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    runtimeVersion: '4.0.0',
    versionCode: 62,
  },
  updates: {
    url: `https://u.expo.dev/${projectId}`,
  },
});
