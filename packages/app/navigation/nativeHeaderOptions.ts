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

// The header title is text outside Liquid Glass, so it relies on the top edge
// effect for contrast. On iOS 27 a soft effect forced by an app built with the
// iOS 26 SDK stops at the status bar and leaves the title over sharp content;
// the system's automatic style there is a nearly opaque edge instead.
function getTopScrollEdgeEffect(platformVersion: string | number) {
  return Number.parseInt(String(platformVersion), 10) >= 27
    ? 'automatic'
    : 'soft';
}

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
