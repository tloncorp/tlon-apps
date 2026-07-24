import { BlurView } from 'expo-blur';
import {
  GlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

function canUseLiquidGlass() {
  return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
}

export function ScreenHeaderControlsChrome({ children }: PropsWithChildren) {
  if (canUseLiquidGlass()) {
    return (
      <GlassContainer spacing={8} style={styles.controls}>
        {children}
      </GlassContainer>
    );
  }

  return <View style={styles.controls}>{children}</View>;
}

export function ScreenHeaderControlChrome({ children }: PropsWithChildren) {
  if (canUseLiquidGlass()) {
    return (
      <GlassView isInteractive style={styles.control}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView tint="systemMaterial" intensity={90} style={styles.control}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  control: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
