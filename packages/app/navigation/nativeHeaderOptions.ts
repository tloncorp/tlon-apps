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

export function supportsNativeScrollEdgeChrome(
  platform: string,
  platformVersion: string | number,
  liquidGlassAvailable: boolean
) {
  return (
    liquidGlassAvailable &&
    platform === 'ios' &&
    Number.parseInt(String(platformVersion), 10) >= 26
  );
}

export function getNativeHeaderScrollOptions({
  platform,
  platformVersion,
  liquidGlassAvailable,
  bottomEdgeEffect = 'hidden',
}: {
  platform: string;
  platformVersion: string | number;
  liquidGlassAvailable: boolean;
  bottomEdgeEffect?: 'hidden' | 'soft';
}): NativeStackNavigationOptions {
  if (
    !supportsNativeScrollEdgeChrome(
      platform,
      platformVersion,
      liquidGlassAvailable
    )
  ) {
    return {};
  }

  return {
    headerTransparent: true,
    scrollEdgeEffects: { ...topScrollEdgeEffects, bottom: bottomEdgeEffect },
  };
}

export const nativeHeaderScrollResetOptions: NativeStackNavigationOptions = {
  headerTransparent: false,
  headerBlurEffect: undefined,
  scrollEdgeEffects: undefined,
};
