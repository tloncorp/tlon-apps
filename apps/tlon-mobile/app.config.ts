import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const projectId = '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0';
const isPreview = process.env.APP_VARIANT === 'preview';

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
    postHogApiKey: process.env.POST_HOG_API_KEY,
    notifyProvider: process.env.NOTIFY_PROVIDER,
    notifyService: process.env.NOTIFY_SERVICE,
    apiUrl: process.env.API_URL,
    apiAuthUsername: process.env.API_AUTH_USERNAME,
    apiAuthPassword: process.env.API_AUTH_PASSWORD,
    shipUrlPattern: process.env.SHIP_URL_PATTERN,
    defaultLure: process.env.DEFAULT_LURE,
    defaultPriorityToken: process.env.DEFAULT_PRIORITY_TOKEN,
    defaultTlonLoginEmail: process.env.DEFAULT_TLON_LOGIN_EMAIL,
    defaultTlonLoginPassword: process.env.DEFAULT_TLON_LOGIN_PASSWORD,
    defaultShipLoginUrl: process.env.DEFAULT_SHIP_LOGIN_URL,
    defaultShipLoginAccessCode: process.env.DEFAULT_SHIP_LOGIN_ACCESS_CODE,
    recaptchaSiteKeyAndroid: process.env.RECAPTCHA_SITE_KEY_ANDROID,
    recaptchaSiteKeyIOS: process.env.RECAPTCHA_SITE_KEY_IOS,
  },
  ios: {
    runtimeVersion: '4.0.0',
    buildNumber: '70',
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    runtimeVersion: '4.0.0',
    versionCode: 70,
  },
  updates: {
    url: `https://u.expo.dev/${projectId}`,
  },
});
