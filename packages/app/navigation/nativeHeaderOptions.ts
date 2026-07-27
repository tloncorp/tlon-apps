import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

import {
  supportsNativeScrollEdgeEffects,
  topScrollEdgeEffects,
} from '../ui/components/nativeScrollEdgeEffects';

export const usesNativeStackHeader = Platform.OS !== 'web';

export function getNativeHeaderUnderlayOptions({
  isDarkMode,
}: {
  isDarkMode: boolean;
}): NativeStackNavigationOptions {
  if (Platform.OS !== 'ios') {
    return {};
  }

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
  isDarkMode,
  scrollsUnderHeader = false,
  backgroundColor,
}: {
  title: string;
  isDarkMode: boolean;
  scrollsUnderHeader?: boolean;
  backgroundColor?: string;
}): NativeStackNavigationOptions {
  if (!usesNativeStackHeader) {
    return { headerShown: false };
  }

  const usesTransparentIOSHeader = Platform.OS === 'ios' && scrollsUnderHeader;
  const underlayOptions = usesTransparentIOSHeader
    ? getNativeHeaderUnderlayOptions({ isDarkMode })
    : {};

  return {
    headerShown: true,
    headerBackButtonDisplayMode: 'minimal',
    headerShadowVisible: false,
    headerTitleAlign: Platform.OS === 'android' ? 'center' : undefined,
    headerTitleStyle: {
      fontSize: 17,
      fontWeight: '500',
    },
    headerStyle:
      backgroundColor && !usesTransparentIOSHeader
        ? { backgroundColor }
        : undefined,
    headerTransparent: false,
    headerBlurEffect: undefined,
    scrollEdgeEffects: undefined,
    ...underlayOptions,
    title,
  };
}
