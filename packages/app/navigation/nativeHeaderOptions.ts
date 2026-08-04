import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { mobileTypeStyles } from '@tloncorp/ui';

const screenHeaderTitleStyle = mobileTypeStyles['$label/2xl'];

export const nativeHeaderPresentationOptions = {
  headerShadowVisible: false,
  headerTitleAlign: 'center',
  headerTitleStyle: {
    fontSize: screenHeaderTitleStyle.fontSize,
    fontWeight: screenHeaderTitleStyle.fontWeight,
  },
} as const satisfies NativeStackNavigationOptions;

const topScrollEdgeEffects = {
  top: 'soft',
  bottom: 'hidden',
  left: 'hidden',
  right: 'hidden',
} as const;

export function getNativeHeaderScrollOptions({
  isDarkMode,
  platform,
  platformVersion,
}: {
  isDarkMode: boolean;
  platform: string;
  platformVersion: string | number;
}): NativeStackNavigationOptions {
  if (platform !== 'ios') {
    return {};
  }

  const iosMajorVersion = Number.parseInt(String(platformVersion), 10);
  const supportsNativeScrollEdgeEffects = iosMajorVersion >= 26;

  return {
    headerTransparent: true,
    headerBlurEffect: supportsNativeScrollEdgeEffects
      ? undefined
      : isDarkMode
        ? 'systemMaterialDark'
        : 'systemMaterialLight',
    scrollEdgeEffects: supportsNativeScrollEdgeEffects
      ? topScrollEdgeEffects
      : undefined,
  };
}

export const nativeHeaderScrollResetOptions: NativeStackNavigationOptions = {
  headerTransparent: false,
  headerBlurEffect: undefined,
  scrollEdgeEffects: undefined,
};
