import { BlurView } from 'expo-blur';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

export const usesFloatingPinnedPostBanner = true;

export function PinnedPostBannerChrome({
  children,
}: PropsWithChildren<object>) {
  if (isGlassEffectAPIAvailable() && isLiquidGlassAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" style={styles.chrome}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView tint="systemMaterial" intensity={90} style={styles.chrome}>
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
