import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

declare const process: {
  env: Record<string, string | undefined>;
};

const projectId = '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0';
const isPreview = process.env.APP_VARIANT === 'preview';
const buildGitHash = process.env.EAS_BUILD_GIT_COMMIT_HASH || 'development';

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
    postHogApiKey: isPreview
      ? process.env.POST_HOG_API_KEY_TEST
      : process.env.POST_HOG_API_KEY_PROD,
    postHogInDev: process.env.POST_HOG_IN_DEV,
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
    defaultInviteLinkUrl: process.env.DEFAULT_INVITE_LINK_URL,
    defaultShipLoginUrl: process.env.DEFAULT_SHIP_LOGIN_URL,
    defaultShipLoginAccessCode: process.env.DEFAULT_SHIP_LOGIN_ACCESS_CODE,
    defaultOnboardingPassword: process.env.ONBOARDING_DEFAULT_PASSWORD,
    defaultOnboardingTlonEmail: process.env.ONBOARDING_DEFAULT_TLON_EMAIL,
    defaultOnboardingNickname: process.env.ONBOARDING_DEFAULT_NICKNAME,
    defaultOnboardingPhoneNumber: process.env.ONBOARDING_DEFAULT_PHONE_NUMBER,
    recaptchaSiteKeyAndroid: process.env.RECAPTCHA_SITE_KEY_ANDROID,
    recaptchaSiteKeyIOS: process.env.RECAPTCHA_SITE_KEY_IOS,
    recaptchaSiteKeyIOSTest: process.env.RECAPTCHA_SITE_KEY_IOS_TEST,
    recaptchaSiteKeyAndroidTest: process.env.RECAPTCHA_SITE_KEY_ANDROID_TEST,
    enabledLoggers: process.env.ENABLED_LOGGERS,
    ignoreCosmos: process.env.IGNORE_COSMOS,
    TlonEmployeeGroup: process.env.TLON_EMPLOYEE_GROUP,
    branchKey: process.env.BRANCH_KEY_PROD,
    branchDomain: process.env.BRANCH_DOMAIN_PROD,
    inviteServiceEndpoint: process.env.INVITE_SERVICE_ENDPOINT,
    inviteServiceIsDev: process.env.INVITE_SERVICE_IS_DEV,
    gitHash: buildGitHash ? buildGitHash.substring(0, 7) : 'dev',
    automatedTest: process.env.AUTOMATED_TEST,
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
  },
  ios: {
    runtimeVersion: '4.0.2',
    // demo builds triggered by GitHub require this to be explicitly set rather than handled
    // elsewhere
    bundleIdentifier: ['demo', 'e2e'].includes(process.env.EAS_BUILD_PROFILE!)
      ? 'io.tlon.groups'
      : undefined,
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    runtimeVersion: '4.0.2',
  },
  plugins: [
    'expo-asset',
    'expo-localization',
    'expo-secure-store',
    '@react-native-firebase/app',
    '@react-native-firebase/crashlytics',
    '@react-native-firebase/perf',
    [
      'expo-image-picker',
      {
        photosPermission:
          'The app accesses your photos to allow you to upload images.',
        cameraPermission:
          'The app accesses your camera to allow you to take photos.',
        microphonePermission:
          'The app accesses your microphone to allow you to record audio.',
      },
    ],
    [
      'expo-contacts',
      {
        contactsPermission: 'Allow Tlon Messenger to access your contacts.',
      },
    ],
  ],
  updates: {
    url: `https://u.expo.dev/${projectId}`,
  },
});
