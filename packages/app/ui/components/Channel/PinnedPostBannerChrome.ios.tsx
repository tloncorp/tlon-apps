import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

import { canUseLiquidGlass, glassFallbackBlurProps } from '../glassChrome.ios';

export const usesFloatingPinnedPostBanner = true;

export function PinnedPostBannerChrome({
  children,
}: PropsWithChildren<object>) {
  if (canUseLiquidGlass()) {
    return (
      <GlassView glassEffectStyle="regular" style={styles.chrome}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView {...glassFallbackBlurProps} style={styles.chrome}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  chrome: {
    borderRadius: 22,
    overflow: 'hidden',
  },
});
