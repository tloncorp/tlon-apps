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

function getMajorVersion(platformVersion: string | number) {
  return Number.parseInt(String(platformVersion), 10);
}

// The header title is text outside Liquid Glass, so it relies on the top edge
// effect for contrast. On iOS 27 a soft effect forced by an app built with the
// iOS 26 SDK stops at the status bar and leaves the title over sharp content.
// There the automatic style is the nearly opaque edge Apple recommends for
// that kind of bar.
function getTopScrollEdgeEffect(platformVersion: string | number) {
  return getMajorVersion(platformVersion) >= 27 ? 'automatic' : 'soft';
}

export function supportsNativeScrollEdgeChrome(
  platform: string,
  platformVersion: string | number,
  liquidGlassAvailable: boolean
) {
  return (
    liquidGlassAvailable &&
    platform === 'ios' &&
    getMajorVersion(platformVersion) >= 26
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
    scrollEdgeEffects: {
      top: getTopScrollEdgeEffect(platformVersion),
      bottom: bottomEdgeEffect,
      left: 'hidden',
      right: 'hidden',
    },
  };
}

export const nativeHeaderScrollResetOptions: NativeStackNavigationOptions = {
  headerTransparent: false,
  headerBlurEffect: undefined,
  scrollEdgeEffects: undefined,
};
