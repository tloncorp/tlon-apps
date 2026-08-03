import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

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

export function getNativeHeaderOptions({
  title,
  backgroundColor,
}: {
  title: string;
  backgroundColor?: string;
}): NativeStackNavigationOptions {
  if (Platform.OS === 'web') {
    return { headerShown: false };
  }

  return {
    headerShown: true,
    headerBackButtonDisplayMode: 'minimal',
    headerShadowVisible: false,
    headerTitleAlign: Platform.OS === 'android' ? 'center' : undefined,
    headerTitleStyle: {
      fontSize: 17,
      fontWeight: '500',
    },
    headerStyle: backgroundColor ? { backgroundColor } : undefined,
    title,
  };
}

export const nativeHeaderScrollResetOptions: NativeStackNavigationOptions = {
  headerTransparent: false,
  headerBlurEffect: undefined,
  scrollEdgeEffects: undefined,
};
