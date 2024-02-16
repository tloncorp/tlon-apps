import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const projectId = '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: 'tlon',
  slug: 'groups',
  name: process.env.IS_PREVIEW ? 'Tlon - Preview' : 'Tlon',
  assetBundlePatterns: ['**/*'],
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
    recaptchaSiteKeyAndroid: process.env.RECAPTCHA_SITE_KEY_ANDROID,
    recaptchaSiteKeyIOS: process.env.RECAPTCHA_SITE_KEY_IOS,
  },
  ios: {
    runtimeVersion: '4.0.0',
    buildNumber: '45',
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    runtimeVersion: '4.0.0',
    versionCode: 45,
  },
  updates: {
    url: `https://u.expo.dev/${projectId}`,
  },
});
