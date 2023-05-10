import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  slug: "talk-android",
  name: "Talk for Android",
  owner: "tlon",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
  },
  android: {
    googleServicesFile: "./google-services.json",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "io.tlon.talk",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: {
    eas: {
      projectId: "4f58fdee-62d4-4d0b-8228-ba327f8fe8cc",
    },
    notifyProvider: process.env.ANDROID_NOTIFY_PROVIDER,
    notifyService: process.env.ANDROID_NOTIFY_SERVICE,
  },
  runtimeVersion: {
    policy: "sdkVersion",
  },
  updates: {
    url: "https://u.expo.dev/4f58fdee-62d4-4d0b-8228-ba327f8fe8cc",
  },
});
