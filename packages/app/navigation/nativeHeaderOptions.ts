import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { mobileTypeStyles } from '@tloncorp/ui';
import { Platform } from 'react-native';

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
}: {
  isDarkMode: boolean;
}): NativeStackNavigationOptions {
  if (Platform.OS !== 'ios') {
    return {};
  }

  const iosMajorVersion = Number.parseInt(String(Platform.Version), 10);
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
